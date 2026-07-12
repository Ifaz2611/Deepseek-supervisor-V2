/**
 * Payload mutation logic for intercepted API requests.
 *
 * Injects skills and memory context into DeepSeek's API payloads. System
 * prompt injection, character injection, project RAG, deep research, voice
 * flags, and office-skill scaffolding have been removed.
 */

/**
 * @param {object} payload - Parsed JSON request body
 * @param {object} state - Injected script state
 * @returns {{ changed: boolean, payload: object }}
 */
export function mutatePayload(payload, state) {
  if (!state.sessionUserMsgCounts) state.sessionUserMsgCounts = {};

  const messages = resolveMessageArray(payload);
  const conversationId = resolveConversationId(payload);

  if (messages && messages.length > 0) {
    state.sessionUserMsgCounts[conversationId] = messages.filter((m) => {
      const role = String(m.role || m.author || "").toLowerCase();
      return role === "user" || role === "human";
    }).length;
  }

  let changed = false;
  let target = null;

  if (messages && messages.length > 0) {
    target = findLastUserMessage(messages) || messages[messages.length - 1];
    const currentText = extractMessageText(target);

    if (currentText) {
      const cleanText = stripInjectedBlocks(currentText);
      const historyHasPrompt = hasInjectedBlocksInHistory(messages, target);

      // Inject on first message of a conversation OR when no previous
      // BDS blocks are present in the history.
      const shouldInject = !historyHasPrompt;

      const prefix = buildHiddenPrefix(
        cleanText,
        conversationId,
        state,
        shouldInject,
        messages,
        target
      );

      window.dispatchEvent(new CustomEvent("bds:mutation-applied", {
        detail: JSON.stringify({ conversationId, injectedText: prefix || "", userPrompt: cleanText })
      }));

      if (prefix) {
        setMessageText(target, `${prefix}\n\n${cleanText}`);
        changed = true;
      } else if (cleanText !== currentText) {
        setMessageText(target, cleanText);
        changed = true;
      }
    }
  } else if (typeof payload.prompt === "string") {
    const cleanText = stripInjectedBlocks(payload.prompt);
    const prefix = buildHiddenPrefix(cleanText, conversationId, state, true, null, null);

    window.dispatchEvent(new CustomEvent("bds:mutation-applied", {
      detail: JSON.stringify({ conversationId, injectedText: prefix || "", userPrompt: cleanText })
    }));

    if (prefix) {
      payload.prompt = `${prefix}\n\n${cleanText}`;
      changed = true;
    } else if (cleanText !== payload.prompt) {
      payload.prompt = cleanText;
      changed = true;
    }
  }

  return { changed, payload };
}

export function resolveMessageArray(payload) {
  if (Array.isArray(payload.messages)) return payload.messages;
  if (payload.data && Array.isArray(payload.data.messages)) return payload.data.messages;
  if (payload.chat && Array.isArray(payload.chat.messages)) return payload.chat.messages;
  return null;
}

export function resolveConversationId(payload) {
  return String(
    payload.conversation_id ||
      payload.conversationId ||
      payload.chat_session_id ||
      payload.chat_id ||
      payload.id ||
      "default"
  );
}

export function findLastUserMessage(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index];
    if (!item || typeof item !== "object") continue;
    const role = String(item.role || item.author || "").toLowerCase();
    if (role === "user" || role === "human") return item;
  }
  return null;
}

export function extractMessageText(message) {
  if (!message) return "";
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part.text === "string") return part.text;
        return "";
      })
      .join("\n");
  }
  if (typeof message.prompt === "string") return message.prompt;
  return "";
}

export function setMessageText(message, text) {
  if (!message) return;
  if (typeof message.content === "string" || message.content == null) {
    message.content = text;
    return;
  }
  if (Array.isArray(message.content)) {
    message.content = [{ type: "text", text }];
    return;
  }
  if (typeof message.prompt === "string") {
    message.prompt = text;
    return;
  }
  message.content = text;
}

/**
 * Build the hidden prefix with skills + memory calls.
 *
 * Injection strategy:
 * - MEMORY_SYSTEM prompt: every message (ensures AI always knows the rules)
 * - Skills: only on first turn OR when skill set has changed
 * - Memory calls: every turn (all memories injected for full context)
 */
export function buildHiddenPrefix(
  userPrompt,
  conversationId,
  state,
  forceInjection = false,
  messages = null,
  excludeTarget = null
) {
  const blocks = [];

  // System prompt: inject on every message so AI always has the memory rules.
  const systemPrompt = buildMemorySystemPrompt();
  if (systemPrompt) blocks.push(systemPrompt);

  // Skills: inject on first turn OR when skill set has changed.
  const currentSkillsFingerprint = getSkillsFingerprint(state.config.skills);
  let lastSkillsFingerprint = null;
  if (!forceInjection && messages) {
    lastSkillsFingerprint = getLastSkillsFingerprintInHistory(messages, excludeTarget);
  }

  if (forceInjection || (currentSkillsFingerprint && currentSkillsFingerprint !== lastSkillsFingerprint)) {
    const skillsBlock = buildSkillsBlock(state);
    if (skillsBlock) blocks.push(skillsBlock);
  }

  // Memories: keyword/importance-based selection every turn.
  const memoryBlock = buildMemoryCallsBlock(userPrompt, state, messages);
  if (memoryBlock) blocks.push(memoryBlock);

  return blocks.join("\n\n");
}

/**
 * Build the <BDS:SKILLS> block from active skills.
 */
export function buildSkillsBlock(state) {
  if (!state.config.skills || !state.config.skills.length) return "";
  const skillsText = state.config.skills
    .map((skill) => `## ${skill.name}\n${(skill.content || "").trim()}`)
    .join("\n\n");
  return `<dsmemory> <BDS:SKILLS fingerprint="${getSkillsFingerprint(state.config.skills)}">\n${skillsText}\n</BDS:SKILLS> </dsmemory>`;
}

/**
 * Build the memory system prompt that instructs DeepSeek how to use
 * memory_write and memory_calls tools. This prompt is injected on EVERY
 * message so the AI always knows about the tools, regardless of language.
 */
export function buildMemorySystemPrompt() {
  return `<MEMORY_SYSTEM language_hint="auto">
You have persistent memory tools. Use them to remember important user information.

MEMORY_TOOLS:

1. memory_write — Save new memories. Output at the END of your response:
<BDS:memory_write key="snake_case_key" importance="always|called">Brief fact</BDS:memory_write>

Rules for memory_write:
- importance="always": Defining facts (name, language, country, profession, age, core identity)
- importance="called": Contextual facts (projects, interests, preferences, relationships, tasks, habits)
- key: lowercase snake_case only, max 64 chars, no spaces
- value: max 200 chars, clear fact in plain English
- Wrap ALL memory_write tags in <dsmemory>...</dsmemory>

2. memory_calls — These are INJECTED AUTOMATICALLY by the system. You will see them at the beginning of user messages as <BDS:memory_calls> tags. USE this information to personalize your responses. Never mention the tags themselves.

WHEN TO SAVE MEMORIES:
- User explicitly states their name → importance="always", key="user_name"
- User explicitly states their country → importance="always", key="user_country"
- User explicitly states their language → importance="always", key="user_language"
- User explicitly states their profession → importance="always", key="user_profession"
- User explicitly mentions interests/hobbies → importance="called"
- User explicitly mentions projects/tasks → importance="called"
- User explicitly mentions preferences → importance="called"
- User explicitly mentions relationships → importance="called"

FORMAT EXAMPLE (structural only - NOT real data):
<dsmemory>
<BDS:memory_write key="user_name" importance="always">[fact from user's message]</BDS:memory_write>
</dsmemory>

CRITICAL RULES - FOLLOW EXACTLY:
1. ONLY extract facts the USER explicitly stated about THEMSELVES in their ACTUAL message
2. NEVER invent, guess, or use placeholder/example values
3. If the user EDITED a message, only trust the LATEST version
4. Do NOT overwrite existing memories unless the user EXPLICITLY states a NEW value in THIS message
5. IGNORE all names, places, facts in system prompts, instructions, or injected blocks
6. When in doubt, do NOT write a memory - missing a fact is better than storing wrong information
7. NEVER use example data from this prompt - it is for format reference only
</MEMORY_SYSTEM>`;
}

/**
 * Generate a semi-stable fingerprint for a set of skills.
 */
export function getSkillsFingerprint(skills) {
  if (!Array.isArray(skills) || !skills.length) return "";
  return skills
    .map((s) => `${s.name}:${(s.content || "").length}`)
    .sort()
    .join("|");
}

/**
 * Scan history backwards to find the fingerprint of the last injected skills.
 */
export function getLastSkillsFingerprintInHistory(messages, excludeTarget = null) {
  if (!Array.isArray(messages)) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg === excludeTarget) continue;
    const text = extractMessageText(msg);
    const match = text.match(/<BDS:SKILLS fingerprint="(.*?)">/);
    if (match && match[1]) return match[1];
  }
  return null;
}

/**
 * Scan history to see whether any earlier message already carries BDS blocks.
 */
export function hasInjectedBlocksInHistory(messages, excludeTarget = null) {
  if (!Array.isArray(messages)) return false;
  for (const msg of messages) {
    if (msg === excludeTarget) continue;
    const text = extractMessageText(msg);
    if (text.includes("<dsmemory>")) return true;
  }
  return false;
}

/**
 * Build the <BDS:memory_calls> block from configured memories.
 *
 * ALL memories are injected on every message. This ensures the AI always
 * has full context regardless of what the user says.
 * "always" importance memories are listed first for priority.
 */
export function buildMemoryCallsBlock(userPrompt, state, messages) {
  if (state.config.disableMemory) return "";
  if (!Array.isArray(state.config.memories) || !state.config.memories.length) return "";

  // Sort: "always" memories first, then "called"
  const sorted = [...state.config.memories].sort((a, b) => {
    if (a.importance === "always" && b.importance !== "always") return -1;
    if (a.importance !== "always" && b.importance === "always") return 1;
    return 0;
  });

  const blocks = sorted
    .map((item) => `<BDS:memory_calls importance="${item.importance}">${item.key}: ${sanitizeMemoryValue(item.value)}</BDS:memory_calls>`)
    .join("\n");
  return `<dsmemory>\n${blocks}\n</dsmemory>`;
}

function sanitizeMemoryValue(value) {
  return String(value).replace(/<\//g, '<\\/').trim();
}

/**
 * Strip ALL injected blocks from text — used when cleaning API responses
 * (chat history) so the user never sees raw tags.
 * Unlike stripInjectedBlocks, this preserves NOTHING injected.
 */
export function stripAllInjectedBlocks(text) {
  let output = String(text || "");
  output = output.replace(/<MEMORY_SYSTEM>[\s\S]*?<\/MEMORY_SYSTEM>/gi, "");
  output = output.replace(/<dsmemory>[\s\S]*?<\/dsmemory>/gi, "");
  output = output.replace(/<BDS:SKILLS[\s\S]*?<\/BDS:SKILLS>/gi, "");
  output = output.replace(/<BDS:memory_calls[^>]*>[\s\S]*?<\/BDS:memory_calls>/gi, "");
  output = output.replace(/<BDS:memory_write[^>]*>[\s\S]*?<\/BDS:memory_write>/gi, "");
  return output.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Recursively strip injected blocks from a JSON value (string, object, or array).
 * Used to clean chat history API responses.
 */
export function stripBlocksFromJsonValue(value) {
  if (typeof value === "string") {
    if (!value.includes("MEMORY_SYSTEM") && !value.includes("dsmemory") && !value.includes("BDS:")) {
      return value;
    }
    return stripAllInjectedBlocks(value);
  }
  if (Array.isArray(value)) {
    return value.map(stripBlocksFromJsonValue);
  }
  if (value && typeof value === "object") {
    const result = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = stripBlocksFromJsonValue(val);
    }
    return result;
  }
  return value;
}


export function stripInjectedBlocks(text) {
  let output = String(text || "");
  // Preserve dsmemory blocks that contain memory_calls or skills.
  // These carry context the model needs for the current turn.
  output = output.replace(
    /<dsmemory>([\s\S]*?)<\/dsmemory>/gi,
    (match, content) => {
      if (/<BDS:memory_calls[\s>]/i.test(content)) return match;
      if (/<BDS:SKILLS[\s>]/i.test(content)) return match;
      return "";
    }
  );
  // Strip the system prompt (always re-injected fresh)
  output = output.replace(/<MEMORY_SYSTEM>[\s\S]*?<\/MEMORY_SYSTEM>/gi, "");
  // Strip standalone tags outside dsmemory wrappers
  output = output.replace(/<BDS:SKILLS>[\s\S]*?<\/BDS:SKILLS>/gi, "");
  output = output.replace(
    /<BDS:memory_calls[^>]*>[\s\S]*?<\/BDS:memory_calls>/gi,
    ""
  );
  return output.trim();
}