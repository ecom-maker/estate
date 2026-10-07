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

GRAPH_URL = "https://graph.facebook.com/v22.0"

# The emoji reaction is decided here in n8n with one small Gemini call, not by
# the app's sales agent: it needs no database and no history, and the agent
# takes 10-30 s. Keep the list short; anything else the model returns is dropped.
REACTION_MODEL = "gemini-3.5-flash"
REACTION_EMOJIS = ["👍", "❤️", "😂", "🙏", "🎉", "👋", "😊"]
REACTION_PROMPT = (
    "You work for a Dubai real-estate agency and read each WhatsApp message a customer "
    "sends. Decide whether a friendly human agent would react to it with an emoji before "
    "replying. React only when it feels natural: a greeting (👋), thanks or appreciation "
    "(🙏 or ❤️), agreement, confirmation or good news such as booking a viewing (👍), "
    "excitement or a celebration (🎉), a joke (😂), a warm personal message (😊). "
    "Do NOT react to plain questions, property searches, prices, complaints, problems or "
    "anything sensitive - most messages need no reaction, so answer \"none\" for those. "
    "Return JSON only."
)

BUILD_REQUEST_JS = """\
// n8n is only the messenger. It sends the app four things and keeps no state of
// its own: no chat history, no sessions, no database credentials. The app looks
// up this sender's history by phone number and saves both sides of the
// conversation itself.
//
// Typed messages and voice notes both arrive here. For a voice note the text is
// the transcript from "Transcribe Voice Note", so the app answers it exactly as
// if the customer had typed it. Always read the original WhatsApp payload from
// the trigger, because on the voice path $json is the transcription output.
const wa = $('WhatsApp Trigger').first().json;
const msg = wa.messages[0];

const message =
  msg.type === "audio"
    ? ($json.content?.parts || []).map((p) => p.text || "").join(" ").trim()
    : msg.text.body;

return [{
  json: {
    // The app normalises this to digits, so "+971 50..." and "97150..." match.
    phone: msg.from,
    message,

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
// Reached by images, documents, locations and stickers, and by voice notes that
// could not be downloaded or understood. Previously these were dropped and the
// customer got silence, which reads as the service being broken.
const wa = $('WhatsApp Trigger').first().json;
const msg = wa.messages[0];

const reply =
  msg.type === "audio"
    ? "Sorry, I couldn't make out that voice note. Could you send it again, " +
      "or type what you are looking for - for example \\"2 bed in Dubai Marina under 3M\\"?"
    : "I can read text messages and voice notes. Please type or say what you " +
      "are looking for - for example \\"2 bed in Dubai Marina under 3M\\".";

return [{
  json: {
    phone: msg.from,
    phone_number_id: wa.metadata.phone_number_id,
    reply,
  },
}];
"""


READ_REACTION_JS = """\
// "Pick Reaction" never stops the run: on a timeout or an API error its output
// is an error object and we simply do not react. Only emojis from the allowed
// list get through, whatever the model wrote.
const ALLOWED = %s;
let emoji = "";
try {
  const text = ($json.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  const picked = JSON.parse(text).emoji;
  if (ALLOWED.includes(picked)) emoji = picked;
} catch (e) {
  emoji = "";
}
return [{ json: { emoji } }];
""" % json.dumps(REACTION_EMOJIS, ensure_ascii=False)


READ_RESPONSE_JS = """// Turns whatever came back from the app into one shape the rest of the flow can
// trust. "Ask the App" reads the body as TEXT and never stops the run, so a
// timeout, an HTML error page or a network failure all arrive here instead of
// crashing the workflow and leaving the customer in silence.
const res = items[0].json;
const SORRY =
  "Sorry, I had trouble looking that up just now. Please send your message again in a moment.";

// With "Response Format: Text" + full response, n8n puts the body in "data"
// (not "body"). Accept either, so a node-version change cannot break this.
const raw = res.data ?? res.body;
let body = null;
try {
  body = typeof raw === "string" ? JSON.parse(raw) : raw;
} catch (e) {
  body = null;
}

const ok = Boolean(body && body.success === true && body.reply);
let error = null;
if (!ok) {
  if (body && body.error) error = typeof body.error === "string" ? body.error : (body.error.message || JSON.stringify(body.error));
  else if (res.error) error = res.error.message || String(res.error);
  else error = "HTTP " + (res.statusCode ?? "?") + ": " + String(raw ?? "").slice(0, 200);
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
        "Show Typing",
        "n8n-nodes-base.httpRequest",
        4.2,
        [80, 300],
        {
            # Marks the message read (blue ticks) and shows "typing..." to the
            # customer at once. WhatsApp keeps it up for 25 s or until our reply
            # lands, which covers most of the app's answer time.
            "method": "POST",
            "url": f"={GRAPH_URL}/{{{{ $json.metadata.phone_number_id }}}}/messages",
            "authentication": "predefinedCredentialType",
            "nodeCredentialType": "whatsAppApi",
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": (
                "={{ JSON.stringify({ messaging_product: 'whatsapp', status: 'read', "
                "message_id: $json.messages[0].id, typing_indicator: { type: 'text' } }) }}"
            ),
            "options": {"timeout": 5000},
        },
        credentials={
            "whatsAppApi": {"id": CRED_PLACEHOLDER, "name": "WhatsApp account"}
        },
        # Cosmetic: a failure here must never cost the customer their answer.
        onError="continueRegularOutput",
    ),
    node(
        "What Kind of Message?",
        "n8n-nodes-base.switch",
        3.2,
        [180, 300],
        {
            "rules": {
                "values": [
                    {
                        **condition("type-text", "={{ $('WhatsApp Trigger').first().json.messages[0].type }}", "text"),
                        "renameOutput": True,
                        "outputKey": "Text",
                    },
                    {
                        **condition("type-audio", "={{ $('WhatsApp Trigger').first().json.messages[0].type }}", "audio"),
                        "renameOutput": True,
                        "outputKey": "Voice Note",
                    },
                ]
            },
            # Images, documents, locations, stickers: explain what we can read.
            "options": {"fallbackOutput": "extra", "renameFallbackOutput": "Other"},
        },
    ),
    node(
        "Download Voice Note",
        "n8n-nodes-base.httpRequest",
        4.2,
        [400, 400],
        {
            # WhatsApp's webhook carries a short-lived media URL. It needs the
            # WhatsApp access token, which the predefined credential supplies.
            "url": "={{ $('WhatsApp Trigger').first().json.messages[0].audio.url }}",
            "authentication": "predefinedCredentialType",
            "nodeCredentialType": "whatsAppApi",
            "options": {
                "timeout": 30000,
                "response": {
                    "response": {"responseFormat": "file", "outputPropertyName": "data"}
                },
            },
        },
        credentials={
            "whatsAppApi": {"id": CRED_PLACEHOLDER, "name": "WhatsApp account"}
        },
        # An expired URL or a WhatsApp outage must still get the customer a reply.
        onError="continueErrorOutput",
    ),
    node(
        "Transcribe Voice Note",
        "@n8n/n8n-nodes-langchain.googleGemini",
        1.2,
        [620, 400],
        {
            "resource": "audio",
            "modelId": {
                "__rl": True,
                "value": "models/gemini-3.5-flash",
                "mode": "list",
                "cachedResultName": "models/gemini-3.5-flash",
            },
            "inputType": "binary",
            "options": {},
        },
        credentials={
            "googlePalmApi": {"id": CRED_PLACEHOLDER, "name": "Google Gemini account"}
        },
        onError="continueErrorOutput",
    ),
    node(
        "Heard Anything?",
        "n8n-nodes-base.if",
        2,
        [840, 400],
        # Silence or noise transcribes to nothing; asking the app about an empty
        # message would get a confusing answer, so explain instead.
        condition(
            "has-transcript",
            "={{ ($json.content?.parts || []).map(p => p.text || '').join(' ').trim() }}",
            "",
            operation="notEmpty",
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
        "Pick Reaction",
        "n8n-nodes-base.httpRequest",
        4.2,
        [440, 80],
        {
            # One short Gemini call, no thinking, JSON constrained to the list.
            # Runs on the transcript too, so voice notes get reactions as well.
            "method": "POST",
            "url": (
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"{REACTION_MODEL}:generateContent"
            ),
            "authentication": "predefinedCredentialType",
            "nodeCredentialType": "googlePalmApi",
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": "={{ JSON.stringify({"
            f" systemInstruction: {{ parts: [{{ text: {json.dumps(REACTION_PROMPT, ensure_ascii=False)} }}] }},"
            " contents: [{ role: 'user', parts: [{ text: $json.message }] }],"
            " generationConfig: { temperature: 0, maxOutputTokens: 30,"
            " thinkingConfig: { thinkingBudget: 0 },"
            " responseMimeType: 'application/json',"
            " responseSchema: { type: 'OBJECT', required: ['emoji'], properties: { emoji: { type: 'STRING', enum:"
            # closes: emoji, properties, responseSchema, generationConfig
            f" {json.dumps(['none'] + REACTION_EMOJIS, ensure_ascii=False)} }} }} }} }}"
            " }) }}",
            "options": {"timeout": 6000},
        },
        credentials={
            "googlePalmApi": {"id": CRED_PLACEHOLDER, "name": "Google Gemini account"}
        },
        onError="continueRegularOutput",
    ),
    node(
        "Read Reaction",
        "n8n-nodes-base.code",
        2,
        [660, 80],
        {"jsCode": READ_REACTION_JS},
    ),
    node(
        "Should React?",
        "n8n-nodes-base.if",
        2,
        [880, 80],
        condition("has-emoji", "={{ $json.emoji }}", "", operation="notEmpty"),
    ),
    node(
        "Send Reaction",
        "n8n-nodes-base.httpRequest",
        4.2,
        [1100, 0],
        {
            "method": "POST",
            "url": f"={GRAPH_URL}/{{{{ $('Build Request').first().json.phone_number_id }}}}/messages",
            "authentication": "predefinedCredentialType",
            "nodeCredentialType": "whatsAppApi",
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": (
                "={{ JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', "
                "to: $('Build Request').first().json.phone, type: 'reaction', "
                "reaction: { message_id: $('Build Request').first().json.wa_message_id, emoji: $json.emoji } }) }}"
            ),
            "options": {"timeout": 5000},
        },
        credentials={
            "whatsAppApi": {"id": CRED_PLACEHOLDER, "name": "WhatsApp account"}
        },
        onError="continueRegularOutput",
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
            # Explicit, because the reaction steps sit between Build Request and here.
            "jsonBody": "={{ JSON.stringify($('Build Request').first().json) }}",
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
        "Explain What We Can Read",
        "n8n-nodes-base.code",
        2,
        [1060, 560],
        {"jsCode": UNSUPPORTED_JS},
    ),
    node(
        "Send Notice",
        "n8n-nodes-base.whatsApp",
        1,
        [1280, 560],
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
    link("Is It a Message?", "Show Typing", 0),    # false -> receipt, ends here
    link("Show Typing", "What Kind of Message?"),
    link("What Kind of Message?", "Build Request", 0),             # text
    link("What Kind of Message?", "Download Voice Note", 1),       # voice note
    link("What Kind of Message?", "Explain What We Can Read", 2),  # anything else
    link("Download Voice Note", "Transcribe Voice Note", 0),
    link("Download Voice Note", "Explain What We Can Read", 1),    # download failed
    link("Transcribe Voice Note", "Heard Anything?", 0),
    link("Transcribe Voice Note", "Explain What We Can Read", 1),  # Gemini failed
    link("Heard Anything?", "Build Request", 0),                   # same path as text
    link("Heard Anything?", "Explain What We Can Read", 1),        # empty transcript
    link("Build Request", "Pick Reaction"),
    link("Pick Reaction", "Read Reaction"),
    link("Read Reaction", "Should React?"),
    link("Should React?", "Send Reaction", 0),
    link("Should React?", "Ask the App", 1),           # no reaction needed
    link("Send Reaction", "Ask the App"),
    link("Ask the App", "Read App Response"),
    link("Read App Response", "Did It Work?"),
    link("Did It Work?", "Send Reply", 0),         # true  -> normal answer
    link("Did It Work?", "Send Sorry Message", 1), # false -> apology, then red
    link("Send Sorry Message", "Mark Execution Failed"),
    link("Explain What We Can Read", "Send Notice"),
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
