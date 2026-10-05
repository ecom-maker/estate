"""Generates scripts/n8n/dmproperties-whatsapp-assistant.json.

The workflow is kept in this script rather than hand-edited as JSON: the Code
nodes hold real JavaScript, and editing it inside a JSON string literal (one
long line, every newline escaped) is where mistakes hide. Change this file and
re-run it:

    python scripts/n8n/build-whatsapp-workflow.py

Then import the generated JSON in n8n: Workflows -> the "..." menu, top right
-> Import from File.
"""

import json
import os

# The deployed app n8n calls (not a browser URL). Defaults to the live site;
# set APP_URL to build a copy for a test deployment, e.g.
#   APP_URL=https://<branch>--<site>.netlify.app python scripts/n8n/build-whatsapp-workflow.py
APP_URL = os.environ.get("APP_URL", "https://estate-sugg.vercel.app").rstrip("/")

CRED_PLACEHOLDER = "REPLACE_WITH_YOUR_CREDENTIAL_ID"
SECRET_PLACEHOLDER = "REPLACE_WITH_WHATSAPP_WEBHOOK_SECRET"

BUILD_REQUEST_JS = """\
// n8n is only the messenger. It sends the app four things and keeps no state of
// its own: no chat history, no sessions, no database credentials. The app looks
// up this sender's history by phone number and saves both sides of the
// conversation itself.
const wa = items[0].json;
const msg = wa.messages[0];

return [{
  json: {
    // The app normalises this to digits, so "+971 50..." and "97150..." match.
    phone: msg.from,
    message: msg.text.body,

    // WhatsApp's own id for this message. The app stores it and refuses to
    // answer the same id twice, so a webhook WhatsApp retries does not produce
    // a second reply to the customer.
    wa_message_id: msg.id,

    // This n8n run. It is written into the whatsapp_logs row, so a failure in
    // the table can be traced back to the exact execution that caused it.
    execution_id: $execution.id,

    // Needed to send the reply back; the app never sees it.
    phone_number_id: wa.metadata.phone_number_id,
  },
}];
"""

UNSUPPORTED_JS = """\
// Voice notes, images, documents and locations reach here. Previously they were
// dropped and the customer got silence, which reads as the service being broken.
const wa = items[0].json;
const msg = wa.messages[0];

return [{
  json: {
    phone: msg.from,
    phone_number_id: wa.metadata.phone_number_id,
    reply:
      "I can only read text messages at the moment. Please type what you are " +
      "looking for - for example \\"2 bed in Dubai Marina under 3M\\".",
  },
}];
"""


READ_RESPONSE_JS = """// Turns whatever came back from the app into one shape the rest of the flow can
// trust. "Ask the App" reads the body as TEXT and never stops the run, so a
// timeout, an HTML error page or a network failure all arrive here instead of
// crashing the workflow and leaving the customer in silence.
const res = items[0].json;
const SORRY =
  "Sorry, I had trouble looking that up just now. Please send your message again in a moment.";

let body = null;
try {
  body = typeof res.body === "string" ? JSON.parse(res.body) : res.body;
} catch (e) {
  body = null;
}

const ok = Boolean(body && body.success === true && body.reply);
let error = null;
if (!ok) {
  if (body && body.error) error = body.error;
  else if (res.error) error = res.error.message || String(res.error);
  else error = "HTTP " + (res.statusCode ?? "?") + ": " + String(res.body ?? "").slice(0, 200);
}

return [{
  json: {
    ok,
    // The app always sends a sentence, even on failure; fall back to our own.
    reply: (body && body.reply) || SORRY,
    error,
    log_id: (body && body.log_id) || null,
  },
}];
"""


def node(name, type_, type_version, position, parameters, **extra):
    n = {
        "parameters": parameters,
        "id": name.lower().replace(" ", "-"),
        "name": name,
        "type": type_,
        "typeVersion": type_version,
        "position": position,
    }
    n.update(extra)
    return n


def condition(cond_id, left, right, operation="equals", type_="string"):
    return {
        "conditions": {
            "options": {
                "caseSensitive": True,
                "leftValue": "",
                "typeValidation": "loose",
                "version": 2,
            },
            "conditions": [
                {
                    "id": cond_id,
                    "leftValue": left,
                    "rightValue": right,
                    "operator": {"type": type_, "operation": operation},
                }
            ],
            "combinator": "and",
        },
        "options": {},
    }


nodes = [
    node(
        "WhatsApp Trigger",
        "n8n-nodes-base.whatsAppTrigger",
        1,
        [-220, 300],
        {"updates": ["messages"]},
        webhookId="dmproperties-whatsapp",
        credentials={
            "whatsAppTriggerApi": {
                "id": CRED_PLACEHOLDER,
                "name": "WhatsApp Trigger account",
            }
        },
    ),
    node(
        "Is It a Message?",
        "n8n-nodes-base.if",
        2,
        [-20, 300],
        # WhatsApp also posts delivery / read receipts to this webhook. They have
        # no "messages" array; they end here quietly instead of failing a run.
        condition(
            "cond-has-message",
            "={{ ($json.messages || []).length > 0 }}",
            "={{ true }}",
            operation="true",
            type_="boolean",
        ),
    ),
    node(
        "Is It Text?",
        "n8n-nodes-base.if",
        2,
        [180, 300],
        condition(
            "cond-text-only",
            "={{ $json.messages[0].type }}",
            "text",
        ),
    ),
    node(
        "Build Request",
        "n8n-nodes-base.code",
        2,
        [220, 200],
        {"jsCode": BUILD_REQUEST_JS},
    ),
    node(
        "Ask the App",
        "n8n-nodes-base.httpRequest",
        4.2,
        [440, 200],
        {
            "method": "POST",
            "url": f"{APP_URL}/api/whatsapp/chat",
            "sendHeaders": True,
            "headerParameters": {
                "parameters": [
                    {"name": "x-webhook-secret", "value": SECRET_PLACEHOLDER}
                ]
            },
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": "={{ JSON.stringify($json) }}",
            "options": {
                "timeout": 60000,
                "response": {
                    "response": {
                        "fullResponse": True,
                        # Text, not JSON: a non-JSON body (timeout page, HTML
                        # error) must not abort the run. "Read App Response"
                        # parses it.
                        "responseFormat": "text",
                        # Without this a 500 aborts the run and the customer is
                        # left in silence. We want the body either way, so the
                        # failure can be read AND something still gets sent.
                        "neverError": True,
                    }
                },
            },
        },
        # Network errors and timeouts are not HTTP responses, so neverError does
        # not cover them; continue with the error instead of stopping.
        onError="continueRegularOutput",
    ),
    node(
        "Read App Response",
        "n8n-nodes-base.code",
        2,
        [550, 200],
        {"jsCode": READ_RESPONSE_JS},
    ),
    node(
        "Did It Work?",
        "n8n-nodes-base.if",
        2,
        [660, 200],
        condition(
            "cond-success",
            "={{ $json.ok }}",
            "={{ true }}",
            operation="true",
            type_="boolean",
        ),
    ),
    node(
        "Send Reply",
        "n8n-nodes-base.whatsApp",
        1,
        [900, 100],
        {
            "operation": "send",
            "phoneNumberId": "={{ $('Build Request').first().json.phone_number_id }}",
            "recipientPhoneNumber": "={{ $('Build Request').first().json.phone }}",
            "messageType": "text",
            "textBody": "={{ $json.reply }}",
        },
        credentials={
            "whatsAppApi": {"id": CRED_PLACEHOLDER, "name": "WhatsApp account"}
        },
    ),
    node(
        "Send Sorry Message",
        "n8n-nodes-base.whatsApp",
        1,
        [900, 300],
        {
            "operation": "send",
            "phoneNumberId": "={{ $('Build Request').first().json.phone_number_id }}",
            "recipientPhoneNumber": "={{ $('Build Request').first().json.phone }}",
            "messageType": "text",
            # The app always returns a sentence to show, even on failure.
            "textBody": "={{ $json.reply }}",
        },
        credentials={
            "whatsAppApi": {"id": CRED_PLACEHOLDER, "name": "WhatsApp account"}
        },
    ),
    node(
        "Mark Execution Failed",
        "n8n-nodes-base.stopAndError",
        1,
        [1140, 300],
        {
            "errorMessage": "={{ 'App error: ' + $('Read App Response').first().json.error "
            "+ ' | log_id: ' + ($('Read App Response').first().json.log_id || 'none') }}"
        },
    ),
    node(
        "Explain Text Only",
        "n8n-nodes-base.code",
        2,
        [220, 440],
        {"jsCode": UNSUPPORTED_JS},
    ),
    node(
        "Send Text-Only Notice",
        "n8n-nodes-base.whatsApp",
        1,
        [440, 440],
        {
            "operation": "send",
            "phoneNumberId": "={{ $json.phone_number_id }}",
            "recipientPhoneNumber": "={{ $json.phone }}",
            "messageType": "text",
            "textBody": "={{ $json.reply }}",
        },
        credentials={
            "whatsAppApi": {"id": CRED_PLACEHOLDER, "name": "WhatsApp account"}
        },
    ),
]


def link(src, dest, output=0):
    return src, dest, output


connections = {}
for src, dest, output in [
    link("WhatsApp Trigger", "Is It a Message?"),
    link("Is It a Message?", "Is It Text?", 0),    # false -> receipt, ends here
    link("Is It Text?", "Build Request", 0),       # true  -> text
    link("Is It Text?", "Explain Text Only", 1),   # false -> everything else
    link("Build Request", "Ask the App"),
    link("Ask the App", "Read App Response"),
    link("Read App Response", "Did It Work?"),
    link("Did It Work?", "Send Reply", 0),         # true  -> normal answer
    link("Did It Work?", "Send Sorry Message", 1), # false -> apology, then red
    link("Send Sorry Message", "Mark Execution Failed"),
    link("Explain Text Only", "Send Text-Only Notice"),
]:
    main = connections.setdefault(src, {"main": []})["main"]
    while len(main) <= output:
        main.append([])
    main[output].append({"node": dest, "type": "main", "index": 0})

workflow = {
    "name": "DMProperties WhatsApp Assistant",
    "nodes": nodes,
    "connections": connections,
    "settings": {"executionOrder": "v1"},
    "active": False,
    "pinData": {},
    "meta": {
        "description": (
            "WhatsApp -> POST /api/whatsapp/chat -> reply. n8n carries messages only: "
            "it holds no chat history and no database credentials, because the app looks "
            "up this sender's WhatsApp history by phone number and saves both sides "
            "itself. WhatsApp history is kept separate from website chat. The app answers "
            "200 even when it fails, with success:false and the real error, so the "
            "customer always gets a sentence while the failure still shows red in n8n and "
            "is written to the whatsapp_logs table against this execution id. "
            "Before activating: set the two WhatsApp credentials, and replace "
            f"{SECRET_PLACEHOLDER} in 'Ask the App' with the value of WHATSAPP_WEBHOOK_SECRET "
            "from the app's environment."
        )
    },
}

out = os.path.join(os.path.dirname(__file__), "dmproperties-whatsapp-assistant.json")
with open(out, "w", encoding="utf-8", newline="\n") as fh:
    json.dump(workflow, fh, indent=2, ensure_ascii=False)
    fh.write("\n")

print(f"wrote {out}")
print(f"{len(nodes)} nodes, {sum(len(v['main']) for v in connections.values())} outputs wired")
