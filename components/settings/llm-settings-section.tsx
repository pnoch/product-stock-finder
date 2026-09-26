import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { SectionHeader } from "./section-header";
import { RadioPicker } from "./radio-picker";
import { testLlmConnection } from "@/lib/server-llm";
import { showAlert } from "@/lib/alert";
import type { AppSettings } from "@/lib/types";

const LLM_PROVIDERS = [
  { label: "Forge (Default)", value: "forge" as const },
  { label: "OpenAI", value: "openai" as const },
  { label: "Ollama Cloud", value: "ollama" as const },
  { label: "Ollama Local", value: "ollama-local" as const },
];

interface Props {
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export function LlmSettingsSection({ settings, onUpdate }: Props) {
  const colors = useColors();
  const [showApiKey, setShowApiKey] = useState(false);
  const [draftApiKey, setDraftApiKey] = useState(settings.llmApiKey ?? "");
  const [draftModel, setDraftModel] = useState(settings.llmModel ?? "");
  const [draftOllamaUrl, setDraftOllamaUrl] = useState(settings.llmOllamaUrl ?? "");

  useEffect(() => { setDraftApiKey(settings.llmApiKey ?? ""); }, [settings.llmApiKey]);
  useEffect(() => { setDraftModel(settings.llmModel ?? ""); }, [settings.llmModel]);
  useEffect(() => { setDraftOllamaUrl(settings.llmOllamaUrl ?? ""); }, [settings.llmOllamaUrl]);

  useEffect(() => {
    if (draftApiKey === (settings.llmApiKey ?? "")) return;
    const t = setTimeout(() => onUpdate("llmApiKey", draftApiKey), 500);
    return () => clearTimeout(t);
  }, [draftApiKey, settings.llmApiKey, onUpdate]);
  useEffect(() => {
    if (draftModel === (settings.llmModel ?? "")) return;
    const t = setTimeout(() => onUpdate("llmModel", draftModel), 500);
    return () => clearTimeout(t);
  }, [draftModel, settings.llmModel, onUpdate]);
  useEffect(() => {
    if (draftOllamaUrl === (settings.llmOllamaUrl ?? "")) return;
    const t = setTimeout(() => onUpdate("llmOllamaUrl", draftOllamaUrl), 500);
    return () => clearTimeout(t);
  }, [draftOllamaUrl, settings.llmOllamaUrl, onUpdate]);

  const provider = settings.llmProvider ?? "forge";
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    if (testing) return;
    setTesting(true);
    try {
      const providerLabel =
        LLM_PROVIDERS.find((p) => p.value === provider)?.label ?? provider;
      const res = await testLlmConnection();
      if (!res) {
        showAlert(
          "Test unavailable",
          "Couldn't reach the server. Check your connection and try again.",
        );
      } else if (res.ok) {
        showAlert("Connection OK", `Your ${providerLabel} provider responded.`);
      } else if (res.reason === "auth") {
        showAlert(
          "Check your API key",
          `Your ${providerLabel} provider rejected the key.`,
        );
      } else {
        showAlert(
          "Connection failed",
          `Your ${providerLabel} provider didn't respond. Check the URL and model.`,
        );
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <View>
      <SectionHeader title="AI / LLM" />

      <RadioPicker
        icon="sparkles"
        label="Provider"
        options={LLM_PROVIDERS}
        value={provider}
        onSelect={(v: string) => onUpdate("llmProvider", v as AppSettings["llmProvider"])}
      />

      {provider !== "forge" && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleTest}
          disabled={testing}
          accessibilityRole="button"
          accessibilityLabel="Test connection"
          style={{
            marginTop: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            paddingVertical: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            opacity: testing ? 0.6 : 1,
          }}
        >
          {testing && <ActivityIndicator size="small" color={colors.primary} />}
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600" }}>
            {testing ? "Testing…" : "Test connection"}
          </Text>
        </TouchableOpacity>
      )}

      {provider === "openai" && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 6 }}>
            API Key
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TextInput
              accessibilityLabel="API key"
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                padding: 10,
                color: colors.foreground,
                fontSize: 14,
              }}
              secureTextEntry={!showApiKey}
              value={draftApiKey}
              onChangeText={setDraftApiKey}
              onBlur={() => { if (draftApiKey !== (settings.llmApiKey ?? "")) onUpdate("llmApiKey", draftApiKey); }}
              placeholder="sk-..."
              placeholderTextColor={colors.muted}
            />
            <TouchableOpacity activeOpacity={0.85}
              onPress={() => setShowApiKey(!showApiKey)}
              style={{ marginLeft: 8, padding: 8 }}
              accessibilityLabel={showApiKey ? "Hide API key" : "Show API key"}
              accessibilityRole="button"
            >
              <Text style={{ color: colors.primary, fontSize: 13 }}>
                {showApiKey ? "Hide" : "Show"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 13, color: colors.muted, marginTop: 12, marginBottom: 6 }}>
            Model
          </Text>
          <TextInput
              accessibilityLabel="Image model"
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              padding: 10,
              color: colors.foreground,
              fontSize: 14,
            }}
            value={draftModel}
            onChangeText={setDraftModel}
            onBlur={() => { if (draftModel !== (settings.llmModel ?? "")) onUpdate("llmModel", draftModel); }}
            placeholder="dall-e-3"
            placeholderTextColor={colors.muted}
          />
        </View>
      )}

      {provider === "ollama" && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 6 }}>
            API Key
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TextInput
              accessibilityLabel="Ollama API key"
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                padding: 10,
                color: colors.foreground,
                fontSize: 14,
              }}
              secureTextEntry={!showApiKey}
              value={draftApiKey}
              onChangeText={setDraftApiKey}
              onBlur={() => { if (draftApiKey !== (settings.llmApiKey ?? "")) onUpdate("llmApiKey", draftApiKey); }}
              placeholder="ollama_..."
              placeholderTextColor={colors.muted}
            />
            <TouchableOpacity activeOpacity={0.85}
              onPress={() => setShowApiKey(!showApiKey)}
              style={{ marginLeft: 8, padding: 8 }}
              accessibilityLabel={showApiKey ? "Hide API key" : "Show API key"}
              accessibilityRole="button"
            >
              <Text style={{ color: colors.primary, fontSize: 13 }}>
                {showApiKey ? "Hide" : "Show"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 13, color: colors.muted, marginTop: 12, marginBottom: 6 }}>
            Ollama URL
          </Text>
          <TextInput
              accessibilityLabel="Ollama base URL"
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              padding: 10,
              color: colors.foreground,
              fontSize: 14,
            }}
            value={draftOllamaUrl}
            onChangeText={setDraftOllamaUrl}
            onBlur={() => { if (draftOllamaUrl !== (settings.llmOllamaUrl ?? "")) onUpdate("llmOllamaUrl", draftOllamaUrl); }}
            placeholder="https://ollama.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={{ fontSize: 13, color: colors.muted, marginTop: 12, marginBottom: 6 }}>
            Model (optional)
          </Text>
          <TextInput
              accessibilityLabel="Ollama chat model"
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              padding: 10,
              color: colors.foreground,
              fontSize: 14,
            }}
            value={draftModel}
            onChangeText={setDraftModel}
            onBlur={() => { if (draftModel !== (settings.llmModel ?? "")) onUpdate("llmModel", draftModel); }}
            placeholder="gemma4"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      )}

      {provider === "ollama-local" && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 6 }}>
            Ollama URL
          </Text>
          <TextInput
              accessibilityLabel="Ollama local URL"
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              padding: 10,
              color: colors.foreground,
              fontSize: 14,
            }}
            value={draftOllamaUrl}
            onChangeText={setDraftOllamaUrl}
            onBlur={() => { if (draftOllamaUrl !== (settings.llmOllamaUrl ?? "")) onUpdate("llmOllamaUrl", draftOllamaUrl); }}
            placeholder="http://localhost:11434"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={{ fontSize: 13, color: colors.muted, marginTop: 12, marginBottom: 6 }}>
            Model (optional)
          </Text>
          <TextInput
              accessibilityLabel="Vision model"
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              padding: 10,
              color: colors.foreground,
              fontSize: 14,
            }}
            value={draftModel}
            onChangeText={setDraftModel}
            onBlur={() => { if (draftModel !== (settings.llmModel ?? "")) onUpdate("llmModel", draftModel); }}
            placeholder="llava"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      )}

      <Text style={{ fontSize: 12, color: colors.muted, marginTop: 12 }}>
        {provider === "forge"
          ? "Uses the built-in service. AI discovery and price insights run on the server; no key needed."
          : provider === "openai"
            ? "Requires an OpenAI API key. Used for product discovery and price insights."
            : provider === "ollama"
              ? "Uses Ollama Cloud. Requires an API key from ollama.com; used for product discovery and price insights."
              : "Runs against an Ollama server on the app server's host (loopback only). Run 'ollama pull llama3.2' to download the default model."}
      </Text>
    </View>
  );
}
