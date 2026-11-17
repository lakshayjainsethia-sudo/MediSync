import sys
sys.path.insert(0, r'c:\Users\jainm\OneDrive\Desktop\Medisync\ai-service')

def chk(label, ok):
    print(("[PASS] " if ok else "[FAIL] ") + label)

# --- aiCompanionApi.ts ---
with open(r'c:\Users\jainm\OneDrive\Desktop\Medisync\client\src\api\aiCompanionApi.ts', encoding='utf-8') as f:
    ts = f.read()

chk("patient_id not in sendMessage body",        "patient_id: patientId" not in ts)
chk("patientId param removed from sendMessage",  "sendMessage(\n  message: string,\n  conversationId" in ts)
chk("startConversation() has no params",         "startConversation()" in ts)
chk("listConversations() has no params",         "listConversations()" in ts)
chk("getMessages only conversationId param",     "getMessages(\n  conversationId: string\n)" in ts)
chk("deleteConversation only conversationId",    "deleteConversation(conversationId: string)" in ts)

# --- AiCompanion.tsx ---
with open(r'c:\Users\jainm\OneDrive\Desktop\Medisync\client\src\components\AiCompanion\AiCompanion.tsx', encoding='utf-8') as f:
    tsx = f.read()

prompts_block = tsx[tsx.index("SUGGESTED_PROMPTS"):tsx.index("];", tsx.index("SUGGESTED_PROMPTS"))]
chk("no appointment in SUGGESTED_PROMPTS",    "appointment" not in prompts_block.lower())
chk("welcome message has no 'appointments'", "appointments" not in tsx[tsx.index("Hello!"):tsx.index("Hello!") + 200].lower())
chk("sendMessage call no user._id arg",      "sendMessage(text, user._id" not in tsx)
chk("input placeholder no 'appointments'",  "appointments" not in tsx[tsx.index("placeholder"):tsx.index("placeholder") + 100].lower())

# --- docker-compose.yml ---
with open(r'c:\Users\jainm\OneDrive\Desktop\Medisync\docker-compose.yml', encoding='utf-8') as f:
    dc = f.read()

gw_block = dc[dc.index("api-gateway:"):dc.index("# Frontend")]
chk("api-gateway depends_on includes ai-service", "ai-service" in gw_block)
