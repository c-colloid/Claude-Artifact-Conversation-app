# Phase 5: Early Return & Guard Clauses 適用候補箇所

**作成日**: 2025-11-20
**ファイル**: Multi character chat.jsx
**調査結果**: 11箇所の早期リターン適用可能箇所を特定

---

## 実施状況

### ✅ 実施済み（1箇所）

#### 1. scrollToMessage（行1573-1593）
**コミット**: d6f0d3c
**効果**: else削除、処理フロー明確化
**リスク**: 低

---

## 未実施（10箇所）

### 優先度：高（3箇所）

#### 2. finishCurrentMessage（行527-590）
**現在のネストレベル**: 4
**改善後のネストレベル**: 1
**効果**: ネストレベル大幅削減、可読性大幅向上
**リスク**: 低
**推奨度**: ★★★★★

**変更内容**:
```javascript
// 変更前
const finishCurrentMessage = () => {
  if (currentContent.length > 0) {                    // Lv1
    let content = currentContent.join('\n').trim();
    let emotion = null;
    let affection = null;

    if (content) {                                    // Lv2
      // Extract emotion tag
      const emotionMatch = content.match(/\[EMOTION:(\w+)\]/);
      if (emotionMatch && emotions[emotionMatch[1]]) { // Lv3
        emotion = emotionMatch[1];
        content = content.replace(/\[EMOTION:\w+\]/, '').trim();
      }
      // ... 続く（ネストが深い）
    }
  }
  currentContent = [];
};

// 変更後（Early Return使用）
const finishCurrentMessage = () => {
  // Guard Clause 1
  if (currentContent.length === 0) {
    currentContent = [];
    return;
  }

  let content = currentContent.join('\n').trim();
  let emotion = null;
  let affection = null;

  // Guard Clause 2
  if (!content) {
    currentContent = [];
    return;
  }

  // 以降、ネストなしで処理（インデントレベル削減）
  const emotionMatch = content.match(/\[EMOTION:(\w+)\]/);
  if (emotionMatch && emotions[emotionMatch[1]]) {
    emotion = emotionMatch[1];
    content = content.replace(/\[EMOTION:\w+\]/, '').trim();
  }
  // ... 続く
};
```

---

#### 3. loadFromStorage（行1704-1809）
**現在のネストレベル**: 4
**改善後のネストレベル**: 2
**効果**: ネストレベル大幅削減、10行削減
**リスク**: 低
**推奨度**: ★★★★★
**注意**: 実装が複雑なため、慎重に実施すること

**変更内容**:
```javascript
// 変更前
const loadFromStorage = async () => {
  try {
    let data = null;
    // ... IndexedDB読み込み処理

    if (data) {                                       // Lv2
      if (data.characters && data.characters.length > 0) { // Lv3
        // ... 処理
      }
      if (data.conversations && data.conversations.length > 0) { // Lv3
        // ... 処理
      }
      // ... 多数のif文
    }
    return false;
  } catch (err) {
    // ...
  }
};

// 変更後（Guard Clause使用）
const loadFromStorage = async () => {
  try {
    let data = null;
    // ... IndexedDB読み込み処理

    // Guard Clause: データがない場合は早期リターン
    if (!data) {
      return false;
    }

    // 以降、ネストなしで処理
    if (data.characters && data.characters.length > 0) {
      // ... 処理（インデント1段階削減）
    }
    if (data.conversations && data.conversations.length > 0) {
      // ... 処理（インデント1段階削減）
    }
    // ... 多数のif文（全てインデント削減）

    return true;
  } catch (err) {
    // ...
  }
};
```

**削減効果**: 約10行削減（元の `if (data) {` のブロック + 対応する `}` + `return false;`）

---

#### 4. importConversation（行1029-1086）
**現在のネストレベル**: 2
**改善後のネストレベル**: 1
**効果**: else削除、Guard Clause統一
**リスク**: 低
**推奨度**: ★★★★

**変更内容**:
```javascript
// 変更前
const importConversation = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      if (data.conversation && data.characters) {  // Lv1
        // Import処理（30行以上）
        // ...
      } else {                                      // else必須でない
        throw new Error('無効なファイル形式です');
      }
    } catch (err) {
      setError('会話ファイルの読み込みに失敗しました: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
};

// 変更後（Guard Clause使用）
const importConversation = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      // Guard Clause: 必須フィールドがない場合は早期 throw
      if (!data.conversation || !data.characters) {
        throw new Error('無効なファイル形式です');
      }

      // Import処理（30行以上、インデント削減）
      // ...
    } catch (err) {
      setError('会話ファイルの読み込みに失敗しました: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
};
```

---

### 優先度：中（5箇所）

#### 5. fetchModels（行1595-1641）
**現在のネストレベル**: 3
**改善後のネストレベル**: 2
**効果**: ネストレベル削減、エラーハンドリング明確化
**リスク**: 低
**推奨度**: ★★★★

**変更内容**:
```javascript
// 変更前
const fetchModels = async () => {
  setIsLoadingModels(true);
  try {
    const response = await fetch(/* ... */);

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();

    if (data.data && Array.isArray(data.data)) { // Lv1
      // ... 処理
      if (!formattedModels.find(m => m.id === selectedModel)) { // Lv2
        // ...
        if (defaultModel) {                     // Lv3
          setSelectedModel(defaultModel.id);
        }
      }
    } else {
      throw new Error('Invalid response format');
    }
  } catch (err) {
    // ...
  } finally {
    setIsLoadingModels(false);
  }
};

// 変更後（Guard Clause使用）
const fetchModels = async () => {
  setIsLoadingModels(true);
  try {
    const response = await fetch(/* ... */);

    // Guard Clause: API呼び出し失敗時
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();

    // Guard Clause: データ形式が不正な場合
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid response format');
    }

    // メイン処理（ネスト削減）
    // ...

    // デフォルトモデル設定（ネスト削減）
    if (formattedModels.find(m => m.id === selectedModel)) {
      return;  // 選択モデルが存在する場合は処理終了
    }

    const defaultModel = formattedModels.find(m => m.id.includes('sonnet-4-5'))
      ?? formattedModels[0];

    if (defaultModel) {
      setSelectedModel(defaultModel.id);
    }
  } catch (err) {
    // ...
  } finally {
    setIsLoadingModels(false);
  }
};
```

---

#### 6. getShortName（行361-378）
**現在のネストレベル**: 3
**改善後のネストレベル**: 2（または1）
**効果**: ネスト削減、Guard Clause統一
**リスク**: 低
**推奨度**: ★★★

**変更内容（オプション1: 最小変更）**:
```javascript
// 変更前
const getShortName = (displayName, modelId) => {
  if (displayName) {
    return displayName.replace('Claude ', '');
  }
  if (modelId.includes('opus')) {
    if (modelId.includes('4-1')) return 'Opus 4.1';
    if (modelId.includes('4')) return 'Opus 4';
  }
  // ... 以下同様
  return modelId;
};

// 変更後（既に最適、コメント追加のみ推奨）
const getShortName = (displayName, modelId) => {
  // Guard Clause: displayNameがある場合は早期リターン
  if (displayName) {
    return displayName.replace('Claude ', '');
  }
  // 以降、modelIdから判定（既に最適）
  if (modelId.includes('opus')) {
    if (modelId.includes('4-1')) return 'Opus 4.1';
    if (modelId.includes('4')) return 'Opus 4';
  }
  // ...
  return modelId;
};
```

**変更内容（オプション2: 完全フラット化）**:
```javascript
const getShortName = (displayName, modelId) => {
  // Guard Clause
  if (displayName) {
    return displayName.replace('Claude ', '');
  }

  // opus（ネストレベル削減）
  if (modelId.includes('opus-4-1')) return 'Opus 4.1';
  if (modelId.includes('opus') && modelId.includes('4')) return 'Opus 4';

  // sonnet
  if (modelId.includes('sonnet-4-5')) return 'Sonnet 4.5';
  if (modelId.includes('sonnet') && modelId.includes('4')) return 'Sonnet 4';

  // haiku
  if (modelId.includes('haiku-4-5')) return 'Haiku 4.5';
  if (modelId.includes('haiku') && modelId.includes('4')) return 'Haiku 4';

  return modelId;
};
```

---

#### 7. getEffectiveCharacter（行474-516）
**現在のネストレベル**: 3
**改善後のネストレベル**: 2
**効果**: Guard Clause統一
**リスク**: 低
**推奨度**: ★★

**変更内容**:
```javascript
// 変更前
const getEffectiveCharacter = useCallback((character) => {
  if (!character) return null;

  // If no base, return as-is
  if (!character.baseCharacterId) {
    return character;
  }

  // Get base character
  const baseChar = getCharacterById(character.baseCharacterId);
  if (!baseChar) {
    return character;
  }

  // ... マージ処理
}, [getCharacterById]);

// 変更後（Guard Clause統一、コメント整理）
const getEffectiveCharacter = useCallback((character) => {
  // Guard Clauses: 無効なキャラクターは早期リターン
  if (!character) return null;
  if (!character.baseCharacterId) return character;

  // Get base character
  const baseChar = getCharacterById(character.baseCharacterId);
  if (!baseChar) return character;

  // Get effective base (recursive for multi-level inheritance)
  const effectiveBase = getEffectiveCharacter(baseChar);

  // ... マージ処理
}, [getCharacterById]);
```

---

#### 8. buildSystemPrompt - forEach内（行748-779）
**現在のネストレベル**: 3
**改善後のネストレベル**: 1
**効果**: ヘルパー関数化でネスト削減、再利用性向上
**リスク**: 低
**推奨度**: ★★★★

**変更内容**:
```javascript
// 変更前
participants.forEach((char, idx) => {
  const def = char.definition;
  const feat = char.features;
  prompt += `## ${idx + 1}. ${char.name}\n`;
  prompt += `- 性格: ${def.personality}\n`;
  prompt += `- 話し方: ${def.speakingStyle}\n`;
  // ...
  if (def.background) prompt += `- 背景: ${def.background}\n`;  // Lv2
  if (def.catchphrases && def.catchphrases.length > 0) {       // Lv2
    prompt += `- 口癖: ${def.catchphrases.join('、')}\n`;
  }
  // ... 多数のif文
  prompt += `\n`;
});

// 変更後（ヘルパー関数化）
const formatCharacterInfo = (char, emotions) => {
  const def = char.definition;
  const feat = char.features;
  let info = `- 性格: ${def.personality}\n`;
  info += `- 話し方: ${def.speakingStyle}\n`;
  info += `- 一人称: ${def.firstPerson}\n`;
  info += `- 二人称: ${def.secondPerson}\n`;

  if (def.background) info += `- 背景: ${def.background}\n`;
  if (def.catchphrases && def.catchphrases.length > 0) {
    info += `- 口癖: ${def.catchphrases.join('、')}\n`;
  }
  if (feat.emotionEnabled) {
    info += `- 現在の感情: ${emotions[feat.currentEmotion]?.label || '中立'}\n`;
  }
  if (feat.affectionEnabled) {
    info += `- 現在の好感度: ${feat.affectionLevel}/100\n`;
  }
  if (def.customPrompt) {
    info += `\n### 追加設定\n${def.customPrompt}\n`;
  }

  return info;
};

// buildSystemPrompt内で使用
participants.forEach((char, idx) => {
  prompt += `## ${idx + 1}. ${char.name}\n`;
  prompt += formatCharacterInfo(char, emotions);
  prompt += `\n`;
});
```

**追加の修正（relationships forEach）**:
```javascript
// 変更前
conversation.relationships.forEach((rel) => {
  const char1 = rel.char1Id === '__user__' ? { name: 'ユーザー' } : participants.find(c => c.id === rel.char1Id);
  const char2 = rel.char2Id === '__user__' ? { name: 'ユーザー' } : participants.find(c => c.id === rel.char2Id);
  if (char1 && char2) {                                         // Lv2
    prompt += `- ${char1.name} と ${char2.name}: ${rel.type}`;
    if (rel.description) {                                      // Lv3
      prompt += ` (${rel.description})`;
    }
    prompt += `\n`;
  }
});

// 変更後（Guard Clause追加）
conversation.relationships.forEach((rel) => {
  const char1 = rel.char1Id === '__user__' ? { name: 'ユーザー' } : participants.find(c => c.id === rel.char1Id);
  const char2 = rel.char2Id === '__user__' ? { name: 'ユーザー' } : participants.find(c => c.id === rel.char2Id);

  // Guard Clause: 必須フィールドがない場合はスキップ
  if (!char1 || !char2) return;

  prompt += `- ${char1.name} と ${char2.name}: ${rel.type}`;
  if (rel.description) {
    prompt += ` (${rel.description})`;
  }
  prompt += `\n`;
});
```

---

#### 9. deleteConversation（行914-935）
**現在のネストレベル**: 3
**改善後のネストレベル**: 2
**効果**: ネスト削減、条件処理の順序明確化
**リスク**: 低
**推奨度**: ★★★

**変更内容**:
```javascript
// 変更前
const deleteConversation = useCallback((conversationId) => {
  const conv = conversations.find(c => c.id === conversationId);
  if (!conv) return;

  setConfirmDialog({
    title: '確認',
    message: `「${conv.title}」を削除しますか?`,
    onConfirm: () => {
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      if (currentConversationId === conversationId) {           // Lv2
        const remaining = conversations.filter(c => c.id !== conversationId);
        if (remaining.length > 0) {                             // Lv3
          setCurrentConversationId(remaining[0].id);
        } else {
          createNewConversation();
        }
      }
      setConfirmDialog(null);
    },
    onCancel: () => setConfirmDialog(null)
  });
}, [conversations, currentConversationId, createNewConversation]);

// 変更後（Guard Clause & Early Return）
const deleteConversation = useCallback((conversationId) => {
  const conv = conversations.find(c => c.id === conversationId);
  if (!conv) return;

  setConfirmDialog({
    title: '確認',
    message: `「${conv.title}」を削除しますか?`,
    onConfirm: () => {
      setConversations(prev => prev.filter(c => c.id !== conversationId));

      // Guard Clause: 削除された会話が現在の会話でない場合はスキップ
      if (currentConversationId !== conversationId) {
        setConfirmDialog(null);
        return;
      }

      // 現在の会話が削除された場合の処理（ネスト削減）
      const remaining = conversations.filter(c => c.id !== conversationId);

      if (remaining.length > 0) {
        setCurrentConversationId(remaining[0].id);
      } else {
        createNewConversation();
      }

      setConfirmDialog(null);
    },
    onCancel: () => setConfirmDialog(null)
  });
}, [conversations, currentConversationId, createNewConversation]);
```

---

### 優先度：低（2箇所）

#### 10. parseMultiCharacterResponse - loop内（行592-633）
**現在のネストレベル**: 2
**改善後のネストレベル**: 1
**効果**: ヘルパー関数化、重複削除
**リスク**: 中（新たなバグ導入の可能性）
**推奨度**: ★★

**変更内容**:
```javascript
// 変更前
for (const line of lines) {
  // Check for [CHARACTER:name] tag
  const charMatch = line.match(/^\[CHARACTER:([^\]]+)\]/);
  if (charMatch) {
    finishCurrentMessage();
    const charName = charMatch[1].trim();
    const char = conversation.participantIds
      .map(id => getCharacterById(id))
      .find(c => c?.name === charName);
    currentType = 'character';
    currentCharacterId = char?.id ?? null;
    const restOfLine = line.replace(/^\[CHARACTER:[^\]]+\]\s*/, '');
    if (restOfLine) {
      currentContent.push(restOfLine);
    }
    continue;
  }

  // Check for [NARRATION] tag
  const narrationMatch = line.match(/^\[NARRATION\]/);
  if (narrationMatch) {
    finishCurrentMessage();
    currentType = 'narration';
    currentCharacterId = null;
    const restOfLine = line.replace(/^\[NARRATION\]\s*/, '');
    if (restOfLine) {
      currentContent.push(restOfLine);
    }
    continue;
  }

  // Regular line
  currentContent.push(line);
}

// 変更後（ヘルパー関数化）
const processTag = (line, tagPattern, type) => {
  const match = line.match(tagPattern);
  if (!match) return null;

  finishCurrentMessage();
  currentType = type;

  if (type === 'character') {
    const charName = match[1].trim();
    const char = conversation.participantIds
      .map(id => getCharacterById(id))
      .find(c => c?.name === charName);
    currentCharacterId = char?.id ?? null;
  } else {
    currentCharacterId = null;
  }

  const restOfLine = line.replace(tagPattern, '').trim();
  if (restOfLine) {
    currentContent.push(restOfLine);
  }

  return true;
};

// メインループ
for (const line of lines) {
  // Try CHARACTER tag
  if (processTag(line, /^\[CHARACTER:([^\]]+)\]/, 'character')) {
    continue;
  }

  // Try NARRATION tag
  if (processTag(line, /^\[NARRATION\]/, 'narration')) {
    continue;
  }

  // Regular line
  currentContent.push(line);
}
```

---

#### 11. applyCharacterGroup（行959-971）
**現在のネストレベル**: 2
**改善後のネストレベル**: 2（変化なし）
**効果**: 現状で既に良好
**リスク**: 低
**推奨度**: ★（優先度低、変更不要）

**コメント**: この関数は既に適切なGuard Clauseを使用しており、これ以上の最適化は不要。

---

## 統計サマリー

| 優先度 | 件数 | 平均ネスト削減 | 平均リスク |
|--------|------|---------------|-----------|
| 高 | 3 | 2-3レベル | 低 |
| 中 | 5 | 1-2レベル | 低 |
| 低 | 2 | 0-1レベル | 低-中 |
| **実施済み** | 1 | - | - |
| **合計** | 11 | - | - |

---

## 実装時の注意点

### 1. テスト必須項目
- キャラクター/会話のインポート/エクスポート機能
- ストレージからのデータ読み込み
- マルチキャラクター応答の解析
- メッセージのスクロール機能

### 2. リスク管理
- **優先度高**の項目から順に実施
- 各変更後に必ずブラケットバランスチェック:
  ```bash
  python3 << 'EOF'
  file_path = "Multi character chat.jsx"
  with open(file_path, 'r', encoding='utf-8') as f:
      content = f.read()
  braces = content.count('{') - content.count('}')
  parens = content.count('(') - content.count(')')
  print(f"Braces: {braces}, Parens: {parens}")
  EOF
  ```
- 各変更をコミットして、問題があれば即座にrevert可能にする

### 3. 段階的実施の推奨
1. まず**優先度高**の3箇所を実施
2. 動作確認・テスト
3. 問題なければ**優先度中**を実施
4. **優先度低**は時間に余裕があれば実施

---

## 期待される総合効果（全て実施した場合）

- **可読性向上**: 20-30%（ネストレベル大幅削減）
- **保守性向上**: 15-25%（処理フロー明確化）
- **行数削減**: 10-20行程度（主にloadFromStorageから）
- **バグ発生リスク**: 低減傾向（Guard Clauseによる早期リターン）
- **パフォーマンス**: 変化なし（コード改善のため）

---

**最終更新**: 2025-11-20
**次のアクション**: 手動での実装検討、または Phase 3（コード重複削除）に進む
