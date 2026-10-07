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
APP_URL = os.environ.get("APP_URL", "https://dmglobal.me").rstrip("/")

CRED_PLACEHOLDER = "REPLACE_WITH_YOUR_CREDENTIAL_ID"
SECRET_PLACEHOLDER = "REPLACE_WITH_WHATSAPP_WEBHOOK_SECRET"

GRAPH_URL = "https://graph.facebook.com/v22.0"

# Typing indicator + emoji reaction live in a second workflow, reached through
# its webhook, so they run in parallel with the app's answer (n8n runs the steps
# of one workflow one after another).
N8N_URL = "https://n8n.srv1757918.hstgr.cloud"
REACTION_PATH = "dmproperties-whatsapp-react"
REACTION_SECRET_PLACEHOLDER = "REPLACE_WITH_REACTION_SECRET"

# n8n Data Table "whatsapp_last_reply" (columns: phone, last_reply). The main
# workflow saves the assistant's latest reply per phone after sending it; the
# reaction workflow reads it, so a bare "yes" or "ok" is judged against what the
# assistant just asked. One row per customer, overwritten each time.
LAST_REPLY_TABLE_PLACEHOLDER = "REPLACE_WITH_LAST_REPLY_TABLE_ID"
LAST_REPLY_MAX_CHARS = 600


def data_table(table_id):
    return {"__rl": True, "value": table_id, "mode": "id"}


# The emoji reaction is decided in n8n with one small Gemini call, not by the
# app's sales agent: it needs no database search, and the agent takes 10-30 s.
# "lite" is Gemini's fastest tier. It rejects thinkingBudget 0 ("invalid
# argument"); thinkingLevel "minimal" is the fastest setting it accepts.
REACTION_MODEL = "gemini-3.5-flash-lite"
# Used when the primary model errors (overloaded, retired, rejects a setting).
# Both checked against the live API on 2026-10-07: the reaction backup accepts the
# same request shape, the transcription backup accepts audio.
REACTION_BACKUP_MODEL = "gemini-3.1-flash-lite"
TRANSCRIBE_BACKUP_MODEL = "gemini-3.7-flash"
# A friendly agent reacting the way a person would - any emoji that fits, but
# only when a reaction feels natural, not on every message.
REACTION_PROMPT = """\
You are the reaction step of a friendly real-estate assistant on WhatsApp (DM Properties, Dubai). \
Before the assistant replies, decide whether a warm, attentive human agent would react to the customer's \
latest message with an emoji - and if so, which one fits best. Any emoji is allowed; pick the one a \
friendly person would naturally use.

Good moments to react: the customer greets the assistant, shares what they are looking for, gives a \
decision or a requirement (budget, buy or rent, area, picks a listing), says yes to something the \
assistant offered, thanks the assistant, shares good news or excitement, or makes a joke. For example: \
a greeting 👋, a new property search 🏠, a choice or answer 👍, a go-ahead ✅, thanks 🙏, good news 🎉, \
a joke 😄 - these are only examples.

You may also be shown the assistant's previous message. Use it only to understand short replies: "yes" \
to an offer ("Want me to book a viewing?") is a go-ahead, "yes" to a question about their needs is an \
answer, and "ok" after bad news needs no reaction. React to the customer's message, never to the \
assistant's.

Do not react to every message. Answer "none" when a reaction would feel forced or out of place, such as \
plain questions, "ok" or "??", complaints, frustration, problems, and anything sensitive (money trouble, \
legal, health, personal loss). When unsure, answer "none".

Return JSON only: {"emoji": "<one emoji or none>"}."""

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

// The app rejects messages over 2000 characters, which a long voice note can
// exceed; cut it rather than lose the whole question to a validation error.
const message = String(
  msg.type === "audio"
    ? ($json.content?.parts || []).map((p) => p.text || "").join(" ").trim()
    : msg.text.body
).slice(0, 2000);

return [{
  json: {
    // The app normalises this to digits, so "+971 50..." and "97150..." match.
    phone: msg.from,
    message,

    // When we asked. "Read App Response" only retries a failure that came back
    // quickly, so a slow timeout never makes the customer wait twice. The app
    // ignores fields it does not know.
    sent_at: Date.now(),

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
// is an error object and we simply do not react. Any emoji is allowed, but it
// must be exactly ONE emoji - "none", words or several emojis are dropped, so
// WhatsApp is never sent something it would reject.
let emoji = "";
try {
  const text = ($json.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  const picked = String(JSON.parse(text).emoji || "").trim();
  const one = /^\\p{Extended_Pictographic}(\\uFE0F|\\u20E3|\\p{Emoji_Modifier}|\\u200D\\p{Extended_Pictographic}\\uFE0F?)*$/u;
  const flag = /^\\p{Regional_Indicator}{2}$/u;
  if (one.test(picked) || flag.test(picked)) emoji = picked;
} catch (e) {
  emoji = "";
}
return [{ json: { emoji } }];
"""


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

// Worth one more try only when the app never really answered (network error,
// or a hosting-level 5xx page instead of the app's own JSON) AND it failed
// fast. An answer from the app itself - even a failure - is final: the app has
// logged this message id and would just replay the same answer.
const elapsed = Date.now() - Number($('Build Request').first().json.sent_at || 0);
const retryable = !ok && !body && (Boolean(res.error) || Number(res.statusCode) >= 500) && elapsed < 20000;

return [{
  json: {
    ok,
    retryable,
    // The app always sends a sentence, even on failure; fall back to our own.
    reply: (body && body.reply) || SORRY,
    error,
    log_id: (body && body.log_id) || null,
  },
}];
"""

# The latest answer from the app: from the retry if one ran, else the first try.
LATEST_ANSWER = (
    "($('Read Retry Response').isExecuted ? $('Read Retry Response') : $('Read App Response'))"
    ".first().json"
)

# Retries for steps that hit brief network / provider hiccups.
RETRY_FAST = {"retryOnFail": True, "maxTries": 2, "waitBetweenTries": 500}
RETRY_SEND = {"retryOnFail": True, "maxTries": 3, "waitBetweenTries": 2000}


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
        "Start Reaction",
        "n8n-nodes-base.httpRequest",
        4.2,
        [80, 300],
        {
            # Hands the message to the "DMProperties WhatsApp Reactions" workflow,
            # which shows "typing..." and picks an emoji. That webhook answers at
            # once and does its work in its own run, so the reaction happens IN
            # PARALLEL with the app's answer instead of delaying it.
            "method": "POST",
            "url": f"{N8N_URL}/webhook/{REACTION_PATH}",
            "sendHeaders": True,
            "headerParameters": {
                "parameters": [{"name": "x-reaction-secret", "value": REACTION_SECRET_PLACEHOLDER}]
            },
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": "={{ JSON.stringify($json) }}",
            "options": {"timeout": 3000},
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
        retryOnFail=True,
        maxTries=3,
        waitBetweenTries=1000,
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
        # A busy model often answers on the second try; after that, the backup.
        onError="continueErrorOutput",
        retryOnFail=True,
        maxTries=2,
        waitBetweenTries=1000,
    ),
    node(
        "Reload Audio",
        "n8n-nodes-base.code",
        2,
        [620, 560],
        # The failed item may not carry the audio any more; hand the backup model
        # the file exactly as "Download Voice Note" fetched it.
        {"jsCode": "return [{ json: {}, binary: $('Download Voice Note').first().binary }];"},
    ),
    node(
        "Transcribe (Backup Model)",
        "@n8n/n8n-nodes-langchain.googleGemini",
        1.2,
        [840, 560],
        {
            "resource": "audio",
            "modelId": {
                "__rl": True,
                "value": f"models/{TRANSCRIBE_BACKUP_MODEL}",
                "mode": "list",
                "cachedResultName": f"models/{TRANSCRIBE_BACKUP_MODEL}",
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
        # WhatsApp rate limits and brief 5xx are retried; if it still fails the
        # run goes red, which is right - the customer did not get the answer.
        **RETRY_SEND,
    ),
    node(
        "Try Again?",
        "n8n-nodes-base.if",
        2,
        [900, 300],
        condition("cond-retry", "={{ $json.retryable }}", "={{ true }}", operation="true", type_="boolean"),
    ),
    node(
        "Ask the App Again",
        "n8n-nodes-base.httpRequest",
        4.2,
        [1120, 300],
        {
            # Same request as "Ask the App". Same wa_message_id, so if the first
            # call did reach the app, it replays that answer instead of asking
            # the agent twice.
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
            "jsonBody": "={{ JSON.stringify($('Build Request').first().json) }}",
            "options": {
                "timeout": 60000,
                "response": {
                    "response": {"fullResponse": True, "responseFormat": "text", "neverError": True}
                },
            },
        },
        onError="continueRegularOutput",
    ),
    node(
        "Read Retry Response",
        "n8n-nodes-base.code",
        2,
        [1340, 300],
        {"jsCode": READ_RESPONSE_JS},
    ),
    node(
        "Did Retry Work?",
        "n8n-nodes-base.if",
        2,
        [1560, 300],
        condition("cond-retry-ok", "={{ $json.ok }}", "={{ true }}", operation="true", type_="boolean"),
    ),
    node(
        "Remember Last Reply",
        "n8n-nodes-base.dataTable",
        1.1,
        [1120, 100],
        {
            # Runs after the customer already has the reply, so it costs them
            # nothing. The reaction workflow reads this to understand a bare
            # "yes" / "ok" in the customer's next message.
            "resource": "row",
            "operation": "upsert",
            "dataTableId": data_table(LAST_REPLY_TABLE_PLACEHOLDER),
            "matchType": "allConditions",
            "filters": {
                "conditions": [
                    {
                        "keyName": "phone",
                        "condition": "eq",
                        "keyValue": "={{ $('WhatsApp Trigger').first().json.messages[0].from }}",
                    }
                ]
            },
            "columns": {
                "mappingMode": "defineBelow",
                "value": {
                    "phone": "={{ $('WhatsApp Trigger').first().json.messages[0].from }}",
                    "last_reply": (
                        f"={{{{ String({LATEST_ANSWER}.reply || '')"
                        f".slice(0, {LAST_REPLY_MAX_CHARS}) }}}}"
                    ),
                },
                "matchingColumns": [],
                "schema": [
                    {"id": c, "displayName": c, "required": False, "defaultMatch": False,
                     "display": True, "type": "string", "canBeUsedToMatch": True}
                    for c in ("phone", "last_reply")
                ],
            },
            "options": {},
        },
        onError="continueRegularOutput",
        **RETRY_FAST,
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
        **RETRY_SEND,
    ),
    node(
        "Mark Execution Failed",
        "n8n-nodes-base.stopAndError",
        1,
        [1340, 500],
        {
            "errorMessage": f"={{{{ 'App error: ' + {LATEST_ANSWER}.error "
            f"+ ' | log_id: ' + ({LATEST_ANSWER}.log_id || 'none') }}}}"
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
        **RETRY_SEND,
    ),
]


def link(src, dest, output=0):
    return src, dest, output


connections = {}
for src, dest, output in [
    link("WhatsApp Trigger", "Is It a Message?"),
    link("Is It a Message?", "Start Reaction", 0),  # false -> receipt, ends here
    link("Start Reaction", "What Kind of Message?"),
    link("What Kind of Message?", "Build Request", 0),             # text
    link("What Kind of Message?", "Download Voice Note", 1),       # voice note
    link("What Kind of Message?", "Explain What We Can Read", 2),  # anything else
    link("Download Voice Note", "Transcribe Voice Note", 0),
    link("Download Voice Note", "Explain What We Can Read", 1),    # download failed
    link("Transcribe Voice Note", "Heard Anything?", 0),
    link("Transcribe Voice Note", "Reload Audio", 1),              # Gemini failed twice
    link("Reload Audio", "Transcribe (Backup Model)"),
    link("Transcribe (Backup Model)", "Heard Anything?", 0),
    link("Transcribe (Backup Model)", "Explain What We Can Read", 1),  # backup failed too
    link("Heard Anything?", "Build Request", 0),                   # same path as text
    link("Heard Anything?", "Explain What We Can Read", 1),        # empty transcript
    link("Build Request", "Ask the App"),
    link("Ask the App", "Read App Response"),
    link("Read App Response", "Did It Work?"),
    link("Did It Work?", "Send Reply", 0),         # true  -> normal answer
    link("Send Reply", "Remember Last Reply"),
    link("Did It Work?", "Try Again?", 1),         # false -> one quick retry?
    link("Try Again?", "Ask the App Again", 0),
    link("Try Again?", "Send Sorry Message", 1),   # not worth retrying -> apology, then red
    link("Ask the App Again", "Read Retry Response"),
    link("Read Retry Response", "Did Retry Work?"),
    link("Did Retry Work?", "Send Reply", 0),
    link("Did Retry Work?", "Send Sorry Message", 1),
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


# --- Second workflow: "typing..." and the emoji reaction ---------------------
# Called by "Start Reaction" above with the WhatsApp payload as the body. The
# webhook answers immediately, so the main workflow is held up ~0.2 s at most.

# The WhatsApp payload that "Start Reaction" forwarded.
WA = "$('Webhook').first().json.body"

# What Gemini reads: the assistant's previous message when there is one, then
# the customer's new message.
REACTION_USER_TURN = (
    "($('Get Last Reply').first().json.last_reply"
    " ? \"The assistant's previous message:\\n\" + $('Get Last Reply').first().json.last_reply + \"\\n\\n\""
    " : '')"
    f" + \"The customer's new message:\\n\" + {WA}.messages[0].text.body"
)

def pick_reaction(name, model, position, **extra):
    """One short Gemini call, minimal thinking, JSON only. The request is built
    entirely from the Webhook and Get Last Reply, so primary and backup send
    exactly the same thing."""
    return node(
        name,
        "n8n-nodes-base.httpRequest",
        4.2,
        position,
        {
            "method": "POST",
            "url": f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            "authentication": "predefinedCredentialType",
            "nodeCredentialType": "googlePalmApi",
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": "={{ JSON.stringify({"
            f" systemInstruction: {{ parts: [{{ text: {json.dumps(REACTION_PROMPT, ensure_ascii=False)} }}] }},"
            f" contents: [{{ role: 'user', parts: [{{ text: {REACTION_USER_TURN} }}] }}],"
            " generationConfig: { temperature: 0, maxOutputTokens: 50,"
            " thinkingConfig: { thinkingLevel: 'minimal' },"
            " responseMimeType: 'application/json',"
            # closes: emoji, properties, responseSchema, generationConfig
            " responseSchema: { type: 'OBJECT', required: ['emoji'], properties: { emoji: { type: 'STRING' } } } }"
            " }) }}",
            "options": {"timeout": 8000},
        },
        credentials={
            "googlePalmApi": {"id": CRED_PLACEHOLDER, "name": "Google Gemini account"}
        },
        **extra,
    )


reaction_nodes = [
    node(
        "Webhook",
        "n8n-nodes-base.webhook",
        2,
        [0, 300],
        {
            "httpMethod": "POST",
            "path": REACTION_PATH,
            # Answer at once; the rest runs in this workflow's own execution.
            "responseMode": "onReceived",
            "options": {},
        },
        webhookId=REACTION_PATH,
    ),
    node(
        "Is It From Us?",
        "n8n-nodes-base.if",
        2,
        [220, 300],
        # The webhook URL is public; only the main workflow knows this secret.
        condition(
            "secret-matches",
            "={{ $json.headers['x-reaction-secret'] }}",
            REACTION_SECRET_PLACEHOLDER,
        ),
    ),
    node(
        "Show Typing",
        "n8n-nodes-base.httpRequest",
        4.2,
        [440, 300],
        {
            # Marks the message read (blue ticks) and shows "typing..." at once.
            # WhatsApp keeps it up for 25 s or until our reply lands.
            "method": "POST",
            "url": f"={GRAPH_URL}/{{{{ {WA}.metadata.phone_number_id }}}}/messages",
            "authentication": "predefinedCredentialType",
            "nodeCredentialType": "whatsAppApi",
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": (
                "={{ JSON.stringify({ messaging_product: 'whatsapp', status: 'read', "
                f"message_id: {WA}.messages[0].id, typing_indicator: {{ type: 'text' }} }}) }}}}"
            ),
            "options": {"timeout": 5000},
        },
        credentials={
            "whatsAppApi": {"id": CRED_PLACEHOLDER, "name": "WhatsApp account"}
        },
        onError="continueRegularOutput",
        **RETRY_FAST,
    ),
    node(
        "Is It Text?",
        "n8n-nodes-base.if",
        2,
        [660, 300],
        # Voice notes are only transcribed later in the main workflow, so there
        # is no text to react to here; they still get "typing...".
        condition("is-text", f"={{{{ {WA}.messages[0].type }}}}", "text"),
    ),
    node(
        "Get Last Reply",
        "n8n-nodes-base.dataTable",
        1.1,
        [880, 200],
        {
            # The assistant's previous message to this customer, saved by
            # "Remember Last Reply" in the main workflow. A first-time customer
            # has no row; alwaysOutputData lets the flow continue without one.
            "resource": "row",
            "operation": "get",
            "dataTableId": data_table(LAST_REPLY_TABLE_PLACEHOLDER),
            "matchType": "allConditions",
            "filters": {
                "conditions": [
                    {"keyName": "phone", "condition": "eq", "keyValue": f"={{{{ {WA}.messages[0].from }}}}"}
                ]
            },
            "returnAll": False,
            "limit": 1,
        },
        alwaysOutputData=True,
        onError="continueRegularOutput",
        **RETRY_FAST,
    ),
    pick_reaction(
        "Pick Reaction", REACTION_MODEL, [1100, 200],
        # A busy model often answers on the second try; after that, the backup.
        onError="continueErrorOutput", **RETRY_FAST,
    ),
    pick_reaction(
        "Pick Reaction (Backup Model)", REACTION_BACKUP_MODEL, [1100, 400],
        # Last resort: if this fails too, Read Reaction gets an error object and
        # we simply do not react. The reply is never affected.
        onError="continueRegularOutput",
    ),
    node(
        "Read Reaction",
        "n8n-nodes-base.code",
        2,
        [1320, 200],
        {"jsCode": READ_REACTION_JS},
    ),
    node(
        "Should React?",
        "n8n-nodes-base.if",
        2,
        [1540, 200],
        condition("has-emoji", "={{ $json.emoji }}", "", operation="notEmpty"),
    ),
    node(
        "Send Reaction",
        "n8n-nodes-base.httpRequest",
        4.2,
        [1760, 100],
        {
            "method": "POST",
            "url": f"={GRAPH_URL}/{{{{ {WA}.metadata.phone_number_id }}}}/messages",
            "authentication": "predefinedCredentialType",
            "nodeCredentialType": "whatsAppApi",
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": (
                "={{ JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', "
                f"to: {WA}.messages[0].from, type: 'reaction', "
                f"reaction: {{ message_id: {WA}.messages[0].id, emoji: $json.emoji }} }}) }}}}"
            ),
            "options": {"timeout": 5000},
        },
        credentials={
            "whatsAppApi": {"id": CRED_PLACEHOLDER, "name": "WhatsApp account"}
        },
        onError="continueRegularOutput",
        **RETRY_FAST,
    ),
]

reaction_connections = {}
for src, dest, output in [
    link("Webhook", "Is It From Us?"),
    link("Is It From Us?", "Show Typing", 0),   # false -> not ours, ends here
    link("Show Typing", "Is It Text?"),
    link("Is It Text?", "Get Last Reply", 0),   # false -> voice etc., typing only
    link("Get Last Reply", "Pick Reaction"),
    link("Pick Reaction", "Read Reaction", 0),
    link("Pick Reaction", "Pick Reaction (Backup Model)", 1),  # primary failed twice
    link("Pick Reaction (Backup Model)", "Read Reaction"),
    link("Read Reaction", "Should React?"),
    link("Should React?", "Send Reaction", 0),  # false -> no reaction needed
]:
    main = reaction_connections.setdefault(src, {"main": []})["main"]
    while len(main) <= output:
        main.append([])
    main[output].append({"node": dest, "type": "main", "index": 0})

reaction_workflow = {
    "name": "DMProperties WhatsApp Reactions",
    "nodes": reaction_nodes,
    "connections": reaction_connections,
    "settings": {"executionOrder": "v1"},
    "active": False,
    "pinData": {},
    "meta": {
        "description": (
            "Called by 'Start Reaction' in DMProperties WhatsApp Assistant. Shows 'typing...' "
            "and, for text messages, lets a small Gemini call pick an emoji reaction - in "
            "parallel with the app's answer, not before it. Before activating: set the "
            f"WhatsApp and Gemini credentials and replace {REACTION_SECRET_PLACEHOLDER} here "
            "and in 'Start Reaction' with the same random value."
        )
    },
}

out = os.path.join(os.path.dirname(__file__), "dmproperties-whatsapp-reactions.json")
with open(out, "w", encoding="utf-8", newline="\n") as fh:
    json.dump(reaction_workflow, fh, indent=2, ensure_ascii=False)
    fh.write("\n")

print(f"wrote {out}")
print(f"{len(reaction_nodes)} nodes, {sum(len(v['main']) for v in reaction_connections.values())} outputs wired")
