import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { mnemonicNew, mnemonicValidate, mnemonicToPrivateKey, KeyPair } from '@ton/crypto';

import { Buffer } from 'buffer';
global.Buffer = Buffer;

export default function HomeScreen() {
  const [mnemonic, setMnemonic] = useState<string>('');
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  
  const generateNewMnemonic = async () => {
    try {
      setLoading(true);
      const newMnemonic = await mnemonicNew(24);
      setMnemonic(newMnemonic.join(' '));
      setKeyPair(null);
    } catch (error) {
      Alert.alert('Error', `Failed to generate mnemonic: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const generateKeyPair = async () => {
    if (!mnemonic.trim()) {
      Alert.alert('Error', 'Please enter or generate a mnemonic phrase');
      return;
    }

    try {
      setLoading(true);
      const mnemonicWords = mnemonic.trim().split(' ');
      
      const isValid = await mnemonicValidate(mnemonicWords);
      if (!isValid) {
        Alert.alert('Error', 'Invalid mnemonic phrase');
        return;
      }

      const generatedKeyPair = await mnemonicToPrivateKey(mnemonicWords);
      setKeyPair(generatedKeyPair);
    } catch (error) {
      Alert.alert('Error', `Failed to generate key pair: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    setMnemonic('');
    setKeyPair(null);
  };

  return (
    <ScrollView style={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText type="title" style={styles.title}>TON Wallet Generator</ThemedText>
        
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Mnemonic Phrase</ThemedText>
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={generateNewMnemonic}
            disabled={loading}
          >
            <ThemedText style={styles.buttonText}>
              {loading ? 'Generating...' : 'Generate New Mnemonic'}
            </ThemedText>
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder="Enter mnemonic phrase or generate a new one above"
            value={mnemonic}
            onChangeText={setMnemonic}
            multiline
            numberOfLines={3}
            editable={!loading}
          />
        </ThemedView>

        <ThemedView style={styles.section}>
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton]} 
            onPress={generateKeyPair}
            disabled={loading || !mnemonic.trim()}
          >
            <ThemedText style={[styles.buttonText, styles.primaryButtonText]}>
              {loading ? 'Generating...' : 'Generate Key Pair'}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        {keyPair && (
          <ThemedView style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>Generated Key Pair</ThemedText>
            
            <ThemedView style={styles.keyContainer}>
              <ThemedText type="defaultSemiBold" style={styles.keyLabel}>Public Key:</ThemedText>
              <ThemedText style={styles.keyValue} selectable>
                {keyPair.publicKey.toString('hex')}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.keyContainer}>
              <ThemedText type="defaultSemiBold" style={styles.keyLabel}>Private Key:</ThemedText>
              <ThemedText style={styles.keyValue} selectable>
                {keyPair.secretKey.toString('hex')}
              </ThemedText>
            </ThemedView>
          </ThemedView>
        )}

        <TouchableOpacity 
          style={[styles.button, styles.clearButton]} 
          onPress={clearAll}
        >
          <ThemedText style={styles.buttonText}>Clear All</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  title: {
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  section: {
    marginBottom: 25,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  sectionTitle: {
    marginBottom: 15,
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  primaryButton: {
    backgroundColor: '#34C759',
  },
  clearButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButtonText: {
    color: '#fff',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    textAlignVertical: 'top',
  },
  keyContainer: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  keyLabel: {
    marginBottom: 5,
    color: '#333',
  },
  keyValue: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#666',
    lineHeight: 18,
  },
});