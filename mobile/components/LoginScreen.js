import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function LoginScreen({
  email,
  password,
  errors,
  isSubmitting,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}) {
  return (
    <KeyboardAvoidingView style={styles.shell} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.iconBox}>
            <Text style={styles.icon}>🏨</Text>
          </View>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Use your approved credentials to access the Resort Sales Assistant.</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, errors.email ? styles.inputError : null]}
              placeholder="you@example.com"
              value={email}
              onChangeText={onEmailChange}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={[styles.input, errors.password ? styles.inputError : null]}
              placeholder="Enter your password"
              value={password}
              onChangeText={onPasswordChange}
              secureTextEntry
            />
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Log In</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#f3f7ff" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 20 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#e0f2fe",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  icon: { fontSize: 28 },
  title: { fontSize: 28, fontWeight: "700", color: "#102a43" },
  subtitle: { marginTop: 8, color: "#486581", fontSize: 15, marginBottom: 20 },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: "600", color: "#334e68", marginBottom: 6 },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#d9e2ec",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#102a43",
  },
  inputError: { borderColor: "#dc2626" },
  errorText: { marginTop: 6, color: "#dc2626", fontSize: 12 },
  primaryButton: {
    marginTop: 8,
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
