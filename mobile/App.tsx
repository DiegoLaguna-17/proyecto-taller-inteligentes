/**
 * GlucoTracker — App Móvil (React Native)
 *
 * Punto de entrada de la UI. Ver /requirements.md, /design.md y /tasks.md
 * en la raíz del proyecto antes de agregar pantallas: este proyecto
 * sigue Spec Driven Development. TASK-004 cubre el scaffolding inicial.
 */
import React from 'react';
import {SafeAreaView, Text, StyleSheet} from 'react-native';

function App(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>GlucoTracker</Text>
      {/* Pantallas reales (Login, RegistroGlucosa, Historial, Chatbot)
          se agregan en src/screens/ a medida que avanza tasks.md */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  title: {fontSize: 24, fontWeight: '600'},
});

export default App;
