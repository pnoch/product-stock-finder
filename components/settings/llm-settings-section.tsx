import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { SectionHeader } from "./section-header";
import { RadioPicker } from "./radio-picker";
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

  const provider = settings.llmProvider ?? "forge";

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

      {provider === "openai" && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 6 }}>
            API Key
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TextInput
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
              value={settings.llmApiKey ?? ""}
              onChangeText={(v) => onUpdate("llmApiKey", v)}
              placeholder="sk-..."
              placeholderTextColor={colors.muted}
            />
            <TouchableOpacity activeOpacity={0.85}
              onPress={() => setShowApiKey(!showApiKey)}
              style={{ marginLeft: 8, padding: 8 }}
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
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              padding: 10,
              color: colors.foreground,
              fontSize: 14,
            }}
            value={settings.llmModel ?? ""}
            onChangeText={(v) => onUpdate("llmModel", v)}
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
              value={settings.llmApiKey ?? ""}
              onChangeText={(v) => onUpdate("llmApiKey", v)}
              placeholder="ollama_..."
              placeholderTextColor={colors.muted}
            />
            <TouchableOpacity activeOpacity={0.85}
              onPress={() => setShowApiKey(!showApiKey)}
              style={{ marginLeft: 8, padding: 8 }}
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
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              padding: 10,
              color: colors.foreground,
              fontSize: 14,
            }}
            value={settings.llmOllamaUrl ?? ""}
            onChangeText={(v) => onUpdate("llmOllamaUrl", v)}
            placeholder="https://ollama.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={{ fontSize: 13, color: colors.muted, marginTop: 12, marginBottom: 6 }}>
            Model (optional)
          </Text>
          <TextInput
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              padding: 10,
              color: colors.foreground,
              fontSize: 14,
            }}
            value={settings.llmModel ?? ""}
            onChangeText={(v) => onUpdate("llmModel", v)}
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
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              padding: 10,
              color: colors.foreground,
              fontSize: 14,
            }}
            value={settings.llmOllamaUrl ?? ""}
            onChangeText={(v) => onUpdate("llmOllamaUrl", v)}
            placeholder="http://localhost:11434"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={{ fontSize: 13, color: colors.muted, marginTop: 12, marginBottom: 6 }}>
            Model (optional)
          </Text>
          <TextInput
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              padding: 10,
              color: colors.foreground,
              fontSize: 14,
            }}
            value={settings.llmModel ?? ""}
            onChangeText={(v) => onUpdate("llmModel", v)}
            placeholder="llava"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      )}

      <Text style={{ fontSize: 12, color: colors.muted, marginTop: 12 }}>
        {provider === "forge"
          ? "Uses the built-in Forge API for image generation and insights."
          : provider === "openai"
            ? "Requires an OpenAI API key. Used for price insights, product discovery, and image generation."
            : provider === "ollama"
              ? "Uses Ollama Cloud. Requires an API key from ollama.com."
              : "Uses your local Ollama installation. Run 'ollama pull llava' to download a model."}
      </Text>
    </View>
  );
}
