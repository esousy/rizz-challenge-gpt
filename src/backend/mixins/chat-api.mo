import Types "../types/common";
import ChatLib "../lib/chat";
import Text "mo:core/Text";
import Blob "mo:core/Blob";
import Principal "mo:core/Principal";
import Error "mo:core/Error";
import Iter "mo:core/Iter";

mixin (state : Types.CharacterState, openAIKeyRef : { var key : ?Text }, appConfig : { var mockMode : Bool }) {

  // ─────────────────────────────────────────────────────────────────────────────
  // DEPRECATED: IC HTTP OUTCALL PATH FOR OPENAI
  //
  // The ic actor declaration, transform function, extractContentValue helper,
  // and the HTTP outcall branch inside chat() below are all DEPRECATED.
  //
  // Reason: OpenAI responses are non-deterministic. IC consensus requires all
  // 8 replicas to agree on identical bytes. Routing AI chat through IC HTTP
  // outcalls causes unavoidable consensus failures.
  //
  // Live Mode now uses the Next.js server proxy (POST /api/openai-chat-proxy).
  // The frontend calls the proxy directly — the IC canister is NOT involved
  // in OpenAI communication for Live Mode.
  //
  // These declarations are kept for reference ONLY.
  // DO NOT call or re-enable this path for OpenAI chat.
  // ─────────────────────────────────────────────────────────────────────────────

  // IC management canister actor for http_request
  let ic = actor "aaaaa-aa" : actor {
    http_request : shared ({
      url : Text;
      max_response_bytes : ?Nat64;
      method : { #get; #head; #post };
      headers : [{ name : Text; value : Text }];
      body : ?Blob;
      transform : ?{
        function : shared query ({ response : { status : Nat; headers : [{ name : Text; value : Text }]; body : Blob }; context : Blob }) -> async { status : Nat; headers : [{ name : Text; value : Text }]; body : Blob };
        context : Blob;
      };
    }) -> async {
      status : Nat;
      headers : [{ name : Text; value : Text }];
      body : Blob;
    };
  };

  /// IC transform function — normalises the OpenAI response body so all 8 replicas
  /// produce identical bytes and consensus succeeds.
  ///
  /// OpenAI's raw response contains non-deterministic fields that differ per replica:
  ///   "id", "created", "system_fingerprint", "object"
  /// Even when the AI content is identical those fields cause consensus failure.
  ///
  /// Fix: extract ONLY choices[0].message.content and return
  ///   {"content":"<value>"}
  /// so every replica normalises to the same bytes.
  /// MUST be declared before the http_request call that references it.
  public query func transform(
    raw : {
      response : { status : Nat; headers : [{ name : Text; value : Text }]; body : Blob };
      context : Blob;
    }
  ) : async { status : Nat; headers : [{ name : Text; value : Text }]; body : Blob } {
    // CRITICAL: always return a deterministic, normalized body.
    // OpenAI raw responses contain non-deterministic fields (id, created,
    // system_fingerprint) that differ across all 8 IC replicas, causing
    // consensus failure.  We MUST extract only choices[0].message.content
    // and return {"content":"<value>"} so every replica produces identical bytes.
    //
    // Rules:
    //   status  = 200 (hardcoded — never use raw.response.status)
    //   headers = []  (drop all — Date/x-request-id headers are non-deterministic)
    //   body    = {"content":"<extracted>"} or {"content":"{}"} on failure
    //
    // We NEVER fall back to the raw body.
    let fallbackBody : Blob = "{\"content\":\"{}\"}".encodeUtf8();
    let normalizedBody : Blob = switch (raw.response.body.decodeUtf8()) {
      case null { fallbackBody };
      case (?bodyText) {
        // Look for the first "content":" marker (choices[0].message.content)
        let marker = "\"content\":\"";
        let parts = bodyText.split(#text marker).toArray();
        if (parts.size() < 2) {
          // Marker not found — return safe fallback, NEVER the raw body
          fallbackBody
        } else {
          // parts[1] starts right after the opening quote of the content value.
          // Walk forward tracking backslash escapes to find the closing unescaped quote.
          let extracted = extractContentValue(parts[1]);
          let normalized = "{\"content\":\"" # extracted # "\"}";
          normalized.encodeUtf8()
        };
      };
    };
    // status hardcoded to 200, headers always empty — fully deterministic
    { status = 200; headers = []; body = normalizedBody };
  };

  /// Walk `text` (which starts right after the opening `"` of a JSON string value)
  /// and return the string value up to (but not including) the first unescaped `"`.
  /// Escape sequences are kept as-is so the re-wrapped JSON stays valid.
  func extractContentValue(text : Text) : Text {
    let backslash = 0x5C : Nat32;
    let dquote    = 0x22 : Nat32;
    var result = "";
    var escaped = false;
    var done = false;
    for (c in text.chars()) {
      if (done) { /* skip rest */ }
      else {
        let code = c.toNat32();
        if (escaped) {
          // Re-emit the escape sequence verbatim so the outer JSON stays valid
          result #= "\\" # Text.fromChar(c);
          escaped := false;
        } else if (code == backslash) {
          escaped := true;
        } else if (code == dquote) {
          done := true; // end of content value
        } else {
          result #= Text.fromChar(c);
        };
      };
    };
    result;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // NOTE: The chat() function below still contains the deprecated IC HTTP
  // outcall branch (the `else` path when mockMode is false). This branch is
  // NOT used in production — Live Mode calls are handled entirely by the
  // Next.js proxy. The function is kept so the canister compiles and Mock Mode
  // continues to work. DO NOT re-enable the HTTP outcall branch for Live Mode.
  // ─────────────────────────────────────────────────────────────────────────────

  /// Send a user message and receive the character's AI-driven response.
  /// Selects the correct character profile by challengeId, respects conversation phase.
  /// Updates character state (interest, mood) in place.
  public func chat(
    userMessage : Text,
    history : [Types.ChatMessage],
    conversation_phase : Text,
    character_profile_id : Text
  ) : async Types.ChatResponse {
    // If mock mode is enabled, return a mock response immediately
    if (appConfig.mockMode) {
      return ChatLib.mockResponse(state, userMessage, character_profile_id);
    };

    let key = switch (openAIKeyRef.key) {
      case null { return ChatLib.noKeyResponse() };
      case (?k) {
        if (k.size() == 0 or not k.startsWith(#text "sk-")) {
          return ChatLib.noKeyResponse()
        } else k
      };
    };

    let profile = ChatLib.getProfile(character_profile_id);
    let systemPrompt = ChatLib.buildSystemPrompt(state, profile, conversation_phase);
    let messagesJson = ChatLib.buildMessagesJson(systemPrompt, history, userMessage);

    let requestBody = "{\"model\":\"gpt-4o-mini\",\"messages\":" # messagesJson # ",\"temperature\":0,\"top_p\":1,\"max_tokens\":300,\"response_format\":{\"type\":\"json_object\"}}";
    let bodyBlob = requestBody.encodeUtf8();

    // Wrap HTTP outcall in try-catch — uncaught exceptions produce generic "Connection error"
    let response = try {
      await (with cycles = 20_000_000_000) ic.http_request({
        url = "https://api.openai.com/v1/chat/completions";
        max_response_bytes = ?(4096 : Nat64);
        method = #post;
        headers = [
          { name = "Content-Type"; value = "application/json" },
          { name = "Authorization"; value = "Bearer " # key },
        ];
        body = ?bodyBlob;
        transform = ?{
          function = transform;
          context = Blob.fromArray([]);
        };
      });
    } catch (e) {
      let errMsg = e.message();
      return errorResponse(
        state,
        "⚠️ Network error reaching OpenAI: " # errMsg,
        "HTTP outcall failed: " # errMsg
      );
    };


    // ── Decode HTTP response body ─────────────────────────────────────────────
    let bodyText = switch (response.body.decodeUtf8()) {
      case (?t) t;
      case null {
      return errorResponse(state, "⚠️ Could not decode server response. Please try again.", "Response decode failed");
      };
    };

    // ── Check HTTP status code for non-2xx errors ─────────────────────────────
    let status = response.status;
    if (status < 200 or status >= 300) {
      let apiError = ChatLib.extractOpenAIError(bodyText);
      let replyMsg = if (status == 401) {
        "⚠️ Invalid API key — check the OpenAI key in Admin → AI Settings."
      } else if (status == 429) {
        "⚠️ Rate limit exceeded — too many requests. Wait a moment and try again."
      } else if (status >= 500) {
        "⚠️ OpenAI service error — try again later."
      } else {
        "⚠️ API error (" # status.toText() # "). Please try again."
      };
      let hintMsg = switch (apiError) {
        case (?msg) "⚠️ " # msg;
        case null replyMsg;
      };
      return errorResponse(state, replyMsg, hintMsg);
    };

    // ── Check for OpenAI error JSON even on 200 (rare but possible) ───────────
    switch (ChatLib.extractOpenAIError(bodyText)) {
      case (?errMsg) {
        return errorResponse(state, "⚠️ OpenAI error: " # errMsg, errMsg);
      };
      case null {};
    };

    // ── Decode normalized body: {"content":"<JSON string>"} ─────────────────
    // The transform function has already extracted just the content field,
    // eliminating non-deterministic fields (id, created, system_fingerprint).
    // We now extract the content string value and parse it as our structured JSON.
    let content : Text = switch (ChatLib.extractContentFromNormalized(bodyText)) {
      case (?c) c;
      case null {
        // Fallback: try old raw format in case transform was a no-op
        let needle = "\"content\":";
        let splitParts = bodyText.split(#text needle);
        switch (splitParts.next()) {
          case null bodyText;
          case (?_before) {
            switch (splitParts.next()) {
              case null bodyText;
              case (?rest) {
                switch (ChatLib.extractJsonStringValue(rest)) {
                  case (?v) v;
                  case null bodyText;
                };
              };
            };
          };
        };
      };
    };

    let chatResponse = ChatLib.parseOpenAIResponse(content, state);

    // Update character state from the parsed response
    state.interest := chatResponse.updated_interest;
    state.mood := chatResponse.mood;
    state.momentum := chatResponse.momentum;
    state.engagement_level := chatResponse.engagement_level;
    state.conversation_tension := chatResponse.conversation_tension;

    chatResponse;
  };

  /// Build an error ChatResponse that surfaces API/network errors to the user.
  func errorResponse(state : Types.CharacterState, reply : Text, hint : Text) : Types.ChatResponse {
    {
      reply;
      interest_change = 0;
      updated_interest = state.interest;
      mood = state.mood;
      coach_hint = hint;
      coach_tone = "negative";
      score = 0;
      breakdown = { confidence = 0; humor = 0; originality = 0 };
      momentum = state.momentum;
      engagement_level = state.engagement_level;
      conversation_tension = state.conversation_tension;
      feedbackCategory = "negative";
    };
  };

  /// Extract a JSON string value from text starting right after the opening quote
  func extractJsonStringValue(rest : Text) : ?Text {
    ChatLib.extractJsonStringValue(rest);
  };


  /// Reset Sofia's character state to defaults for a new session.
  public func reset() : async () {
    let defaults = ChatLib.defaultCharacterState();
    state.interest := defaults.interest;
    state.mood := defaults.mood;
    state.momentum := defaults.momentum;
    state.engagement_level := defaults.engagement_level;
    state.conversation_tension := defaults.conversation_tension;
  };

  /// Get current Sofia character state snapshot (for frontend display)
  public query func getCharacterState() : async {
    name : Text;
    age : Nat;
    personality : Text;
    interest : Int;
    mood : Text;
    conversation_style : Text;
    momentum : Text;
    engagement_level : Text;
    conversation_tension : Text;
  } {
    {
      name = state.name;
      age = state.age;
      personality = state.personality;
      interest = state.interest;
      mood = state.mood;
      conversation_style = state.conversation_style;
      momentum = state.momentum;
      engagement_level = state.engagement_level;
      conversation_tension = state.conversation_tension;
    };
  };
};
