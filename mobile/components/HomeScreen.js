import React from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const HISTORY_LIMIT = 10;

export default function HomeScreen({
  email,
  question,
  history,
  loading,
  historyTruncated,
  onLogout,
  onClearHistory,
  onQuestionChange,
  onSendQuestion,
  sampleQuestions,
}) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Resort Sales Intelligence Assistant</Text>
            <Text style={styles.subtitle}>Welcome back, {email}.</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardPanel}>
          <Text style={styles.panelTitle}>Ask about revenue, conversion, loss reasons, and follow-ups.</Text>
          <TouchableOpacity style={styles.clearButton} onPress={onClearHistory}>
            <Text style={styles.clearButtonText}>Clear history</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sampleRow}>
          {sampleQuestions.map((sample) => (
            <TouchableOpacity key={sample} style={styles.sampleButton} onPress={() => onSendQuestion(sample)}>
              <Text style={styles.sampleText}>{sample}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {historyTruncated ? (
          <View style={styles.truncateBanner}>
            <Text style={styles.truncateText}>Showing the most recent {HISTORY_LIMIT} questions.</Text>
          </View>
        ) : null}

        <FlatList
          data={history}
          scrollEnabled={false}
          keyExtractor={(item, index) => (item.id ? `${item.id}-${index}` : String(index))}
          style={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.question}>Q: {item.question}</Text>
              <Text style={styles.answer}>A: {item.answer}</Text>
              {item.supportingFigures?.length ? (
                <View style={styles.supportingBox}>
                  {item.supportingFigures.map((figure, index) => (
                    <Text key={`${item.id}-${figure.label}-${index}`} style={styles.figureText}>{figure.label}: {figure.value}</Text>
                  ))}
                </View>
              ) : null}
            </View>
          )}
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Ask a business question"
            value={question}
            onChangeText={onQuestionChange}
            onSubmitEditing={() => onSendQuestion(question)}
          />
          <TouchableOpacity style={styles.button} onPress={() => onSendQuestion(question)}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Ask</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f7fb", padding: 16 },
  contentContainer: { paddingBottom: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  headerTextWrap: { flex: 1, paddingRight: 10 },
  title: { fontSize: 22, fontWeight: "700", color: "#102a43" },
  subtitle: { marginTop: 4, color: "#486581", fontSize: 14 },
  logoutButton: { backgroundColor: "#e2e8f0", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  logoutButtonText: { color: "#102a43", fontWeight: "600" },
  cardPanel: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 12, shadowColor: "#0f172a", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  panelTitle: { color: "#243b53", fontWeight: "600", marginBottom: 10 },
  sampleRow: { marginBottom: 12 },
  sampleButton: { backgroundColor: "#d9e2ec", borderRadius: 8, padding: 8, marginBottom: 8 },
  sampleText: { color: "#102a43" },
  list: { flexGrow: 0, marginBottom: 12 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 10 },
  question: { fontWeight: "700", color: "#102a43", marginBottom: 4 },
  answer: { color: "#243b53", marginBottom: 6 },
  supportingBox: { backgroundColor: "#f8fafc", padding: 8, borderRadius: 8 },
  figureText: { color: "#334e68", marginBottom: 2 },
  inputBar: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  input: { flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: "#d9e2ec", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginRight: 8 },
  button: { backgroundColor: "#2563eb", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, justifyContent: "center" },
  truncateBanner: { backgroundColor: "#e2e8f0", padding: 10, borderRadius: 10, marginBottom: 10 },
  truncateText: { color: "#334e68", fontSize: 13 },
  clearButton: { backgroundColor: "#cbd5e1", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignSelf: "flex-start" },
  clearButtonText: { color: "#102a43", fontWeight: "600" },
  buttonText: { color: "#fff", fontWeight: "700" },
});
