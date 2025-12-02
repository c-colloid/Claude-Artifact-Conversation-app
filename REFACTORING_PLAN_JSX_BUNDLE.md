# JSXバンドル型リファクタリング計画

**作成日**: 2025-12-02
**対象**: Multi Character Chat Application
**目的**: TypeScript分割ファイルで開発 → 単一JSXにバンドル

---

## 📋 概要

このドキュメントは、web-artifacts-builderスキルの考え方を参考にした、JSXバンドル型リファクタリングの最終計画を記録します。

### 基本方針

- **開発時**: TypeScript + 分割ファイル（可読性・保守性向上）
- **バンドル時**: 単一JSXファイル（Claude Artifact形式）
- **GitHub**: ソースコード + バンドル済みJSX 両方管理
- **Claude.ai**: バンドル済みJSXをアーティファクトとして使用

### HTMLバンドルではなくJSXバンドルを選択した理由

| 項目 | HTMLバンドル | JSXバンドル | 選択理由 |
|------|-------------|------------|---------|
| **ファイルサイズ** | 400KB | 250KB | ✅ 40%削減 |
| **構文** | 圧縮されたJS | 読みやすいJSX | ✅ 可読性 |
| **現在との互換性** | 異なる | 完全に同じ | ✅ 継続性 |
| **自己完結性** | 完全 | 外部依存 | Claude.ai専用なので問題なし |
| **デバッグ** | 困難 | 容易 | ✅ 保守性 |

---

## 📁 最終形：プロジェクト構造

### GitHub上の管理構造

```
Claude-Artifact-Conversation-app/
├── src/                                    ← 開発用ソースコード（TypeScript）
│   ├── App.tsx                            # メインコンポーネント
│   ├── types/
│   │   └── index.ts                       # TypeScript型定義
│   ├── hooks/
│   │   ├── useCharacterManager.ts         # キャラクター管理ロジック
│   │   ├── useConversationManager.ts      # 会話管理ロジック
│   │   ├── useMessageManager.ts           # メッセージ管理ロジック
│   │   ├── useClaudeAPI.ts                # API通信ロジック
│   │   └── useStorage.ts                  # ストレージ管理
│   ├── components/
│   │   ├── CharacterModal.tsx             # キャラクター作成/編集
│   │   ├── MessageBubble.tsx              # メッセージ表示
│   │   ├── ConversationView.tsx           # 会話画面
│   │   ├── ConversationCard.tsx           # 会話リスト項目
│   │   ├── ConversationSettings.tsx       # 会話設定パネル
│   │   ├── EmojiPicker.tsx                # 絵文字選択
│   │   ├── ImageCropper.tsx               # 画像切り抜き
│   │   ├── AvatarDisplay.tsx              # アバター表示
│   │   └── ConfirmDialog.tsx              # 確認ダイアログ
│   ├── lib/
│   │   ├── indexedDB.ts                   # IndexedDBラッパー
│   │   └── utils.ts                       # ユーティリティ関数
│   └── constants/
│       └── index.ts                       # 定数定義
│
├── Multi character chat.jsx                ← バンドル済みJSX（本番用）
│
├── scripts/
│   └── bundle-to-jsx.sh                   # バンドルスクリプト
│
├── .gitignore
├── README.md
├── package.json                            # 開発時のみ使用（オプション）
└── tsconfig.json                           # 開発時のみ使用（オプション）
```

### .gitignore

```gitignore
# 開発環境（ローカルでTypeScriptコンパイルする場合）
node_modules/
dist/
build/
.parcel-cache/

# エディタ
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db
```

---

## 🔧 開発時の構造詳細

### 1. 型定義（src/types/index.ts）

**責務**: アプリケーション全体で使用する型定義

```typescript
export interface Character {
  id: string;
  name: string;
  baseCharacterId: string | null;
  overrides: Record<string, boolean>;
  definition: {
    personality: string;
    speakingStyle: string;
    firstPerson: string;
    secondPerson: string;
    background: string;
    catchphrases: string[];
    customPrompt: string;
  };
  features: {
    emotionEnabled: boolean;
    affectionEnabled: boolean;
    autoManageEmotion: boolean;
    autoManageAffection: boolean;
    currentEmotion: string;
    affectionLevel: number;
    avatar: string;
    avatarType: 'emoji' | 'image';
    avatarImage: string | null;
  };
  created: string;
  updated: string;
}

export interface Conversation {
  id: string;
  title: string;
  participantIds: string[];
  backgroundInfo: string;
  narrationEnabled: boolean;
  autoGenerateNarration: boolean;
  relationships: Relationship[];
  messages: Message[];
  parentConversationId?: string;
  forkPoint?: number;
  created: string;
  updated: string;
}

export interface Message {
  id: string;
  type: 'user' | 'character' | 'narration';
  characterId?: string;
  content: string;
  emotion?: string;
  affection?: number;
  thinking?: string;
  timestamp: string;
  alternatives?: MessageAlternative[];
  responseGroupId?: string;
}

export interface Relationship {
  char1Id: string;
  char2Id: string;
  type: string;
  description: string;
}

export interface MessageAlternative {
  id: string;
  content: string;
  emotion?: string;
  affection?: number;
  thinking?: string;
  isActive: boolean;
}
```

### 2. カスタムフック（例：src/hooks/useCharacterManager.ts）

**責務**: キャラクター管理のビジネスロジック

```typescript
import { useState, useCallback } from 'react';
import type { Character } from '../types';

export const useCharacterManager = () => {
  const [characters, setCharacters] = useState<Character[]>([]);

  const createCharacter = useCallback((data: Partial<Character>) => {
    const newCharacter: Character = {
      id: generateId(),
      name: data.name || 'Unnamed',
      baseCharacterId: data.baseCharacterId || null,
      overrides: data.overrides || {},
      definition: {
        personality: data.definition?.personality || '',
        speakingStyle: data.definition?.speakingStyle || '',
        firstPerson: data.definition?.firstPerson || '私',
        secondPerson: data.definition?.secondPerson || 'あなた',
        background: data.definition?.background || '',
        catchphrases: data.definition?.catchphrases || [],
        customPrompt: data.definition?.customPrompt || '',
      },
      features: {
        emotionEnabled: data.features?.emotionEnabled ?? true,
        affectionEnabled: data.features?.affectionEnabled ?? true,
        autoManageEmotion: data.features?.autoManageEmotion ?? true,
        autoManageAffection: data.features?.autoManageAffection ?? true,
        currentEmotion: data.features?.currentEmotion || 'neutral',
        affectionLevel: data.features?.affectionLevel ?? 50,
        avatar: data.features?.avatar || '😊',
        avatarType: data.features?.avatarType || 'emoji',
        avatarImage: data.features?.avatarImage || null,
      },
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };

    setCharacters(prev => [...prev, newCharacter]);
    return newCharacter;
  }, []);

  const updateCharacter = useCallback((id: string, updates: Partial<Character>) => {
    setCharacters(prev => prev.map(char =>
      char.id === id
        ? { ...char, ...updates, updated: new Date().toISOString() }
        : char
    ));
  }, []);

  const deleteCharacter = useCallback((id: string) => {
    setCharacters(prev => prev.filter(char => char.id !== id));
  }, []);

  const getCharacterById = useCallback((id: string) => {
    return characters.find(char => char.id === id);
  }, [characters]);

  const getEffectiveCharacter = useCallback((character: Character): Character => {
    if (!character.baseCharacterId) return character;

    const baseChar = characters.find(c => c.id === character.baseCharacterId);
    if (!baseChar) return character;

    return {
      ...baseChar,
      ...character,
      definition: {
        ...baseChar.definition,
        ...(character.overrides.personality && { personality: character.definition.personality }),
        ...(character.overrides.speakingStyle && { speakingStyle: character.definition.speakingStyle }),
        // ... 他のオーバーライド
      },
    };
  }, [characters]);

  return {
    characters,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    getCharacterById,
    getEffectiveCharacter,
  };
};
```

### 3. コンポーネント（例：src/components/CharacterModal.tsx）

**責務**: キャラクター作成/編集UI

```typescript
import React, { useState, useCallback, useEffect } from 'react';
import { X, Save, Upload, Image as ImageIcon } from 'lucide-react';
import type { Character } from '../types';

interface CharacterModalProps {
  show: boolean;
  character: Character | null;
  onClose: () => void;
  onSave: (character: Partial<Character>) => void;
}

export const CharacterModal: React.FC<CharacterModalProps> = ({
  show,
  character,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [personality, setPersonality] = useState('');
  const [speakingStyle, setSpeakingStyle] = useState('');
  const [avatar, setAvatar] = useState('😊');

  useEffect(() => {
    if (character) {
      setName(character.name);
      setPersonality(character.definition.personality);
      setSpeakingStyle(character.definition.speakingStyle);
      setAvatar(character.features.avatar);
    } else {
      setName('');
      setPersonality('');
      setSpeakingStyle('');
      setAvatar('😊');
    }
  }, [character]);

  const handleSave = useCallback(() => {
    onSave({
      name,
      definition: {
        personality,
        speakingStyle,
        firstPerson: '私',
        secondPerson: 'あなた',
        background: '',
        catchphrases: [],
        customPrompt: '',
      },
      features: {
        avatar,
        avatarType: 'emoji',
        avatarImage: null,
        emotionEnabled: true,
        affectionEnabled: true,
        autoManageEmotion: true,
        autoManageAffection: true,
        currentEmotion: 'neutral',
        affectionLevel: 50,
      },
    });
    onClose();
  }, [name, personality, speakingStyle, avatar, onSave, onClose]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {character ? 'キャラクター編集' : 'キャラクター作成'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">名前</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="キャラクター名"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">性格</label>
            <textarea
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="明るくて元気、面倒見が良い..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">話し方</label>
            <textarea
              value={speakingStyle}
              onChange={(e) => setSpeakingStyle(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="「〜だよ！」「〜だね」といったフレンドリーな口調"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">アバター</label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-3xl">
                {avatar}
              </div>
              <input
                type="text"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg"
                placeholder="絵文字を入力"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <Save size={16} />
            保存
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
};
```

### 4. メインアプリ（src/App.tsx）

**責務**: アプリケーション全体の統合

```typescript
import React, { useState, useEffect } from 'react';
import { Menu, Settings, Plus, Users } from 'lucide-react';
import { CharacterModal } from './components/CharacterModal';
import { ConversationView } from './components/ConversationView';
import { ConversationSettings } from './components/ConversationSettings';
import { useCharacterManager } from './hooks/useCharacterManager';
import { useConversationManager } from './hooks/useConversationManager';
import { useStorage } from './hooks/useStorage';

const App: React.FC = () => {
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  const {
    characters,
    createCharacter,
    updateCharacter,
    deleteCharacter,
  } = useCharacterManager();

  const {
    conversations,
    currentConversationId,
    createConversation,
    updateConversation,
    deleteConversation,
    setCurrentConversation,
  } = useConversationManager();

  const { saveData, loadData } = useStorage();

  // 自動保存
  useEffect(() => {
    const timer = setTimeout(() => {
      saveData({ characters, conversations, currentConversationId });
    }, 2000);
    return () => clearTimeout(timer);
  }, [characters, conversations, currentConversationId, saveData]);

  // 初回ロード
  useEffect(() => {
    loadData().then(data => {
      if (data) {
        // データ復元ロジック
      }
    });
  }, [loadData]);

  const currentConversation = conversations.find(c => c.id === currentConversationId);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-bold">Multi Character Chat</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCharacterModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus size={16} />
              キャラクター
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <Settings size={24} />
            </button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="flex h-[calc(100vh-64px)]">
        {/* サイドバー */}
        {showSidebar && (
          <aside className="w-64 bg-white border-r overflow-y-auto">
            <div className="p-4">
              <h2 className="font-bold mb-3">会話一覧</h2>
              {/* 会話リスト */}
            </div>
          </aside>
        )}

        {/* 会話ビュー */}
        <main className="flex-1 overflow-hidden">
          <ConversationView
            conversation={currentConversation}
            characters={characters}
            onUpdateConversation={updateConversation}
          />
        </main>

        {/* 設定パネル */}
        {showSettings && (
          <aside className="w-80 bg-white border-l overflow-y-auto">
            <ConversationSettings
              conversation={currentConversation}
              characters={characters}
              onUpdate={updateConversation}
            />
          </aside>
        )}
      </div>

      {/* モーダル */}
      <CharacterModal
        show={showCharacterModal}
        character={null}
        onClose={() => setShowCharacterModal(false)}
        onSave={createCharacter}
      />
    </div>
  );
};

export default App;
```

---

## 📦 バンドル後の形式

### Claude Artifact形式JSX（Multi character chat.jsx）

**重要**: import/exportを使用する通常のReact構文

```jsx
/**
 * Multi Character Chat Application
 *
 * バンドル日時: 2025-12-02
 * ソースファイル: src/ ディレクトリ
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AlertCircle, Trash2, Edit2, /* ... */ } from 'lucide-react';

// ========================================
// Utils & Constants
// ========================================

const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const EMOTIONS = ['neutral', 'joy', 'sadness', 'anger', 'fun', 'embarrassed', 'surprised'];

// ========================================
// Custom Hooks
// ========================================

const useCharacterManager = () => {
  // src/hooks/useCharacterManager.ts の内容
  // TypeScript型は削除済み
};

const useConversationManager = () => {
  // src/hooks/useConversationManager.ts の内容
};

// ========================================
// Components
// ========================================

const CharacterModal = React.memo(({ show, character, onClose, onSave }) => {
  // src/components/CharacterModal.tsx の内容
  // TypeScript型は削除済み
});

const MessageBubble = React.memo(({ message, character }) => {
  // src/components/MessageBubble.tsx の内容
});

// ... 他のコンポーネント

// ========================================
// Main App Component
// ========================================

const MultiCharacterChat = () => {
  // src/App.tsx の内容
};

export default MultiCharacterChat;
```

### バンドル時の変換ルール

| 開発時（TypeScript） | バンドル後（JSX） |
|---------------------|------------------|
| `import React from 'react'` | **そのまま維持** |
| `import type { Character } from './types'` | **削除** |
| `const foo: Character = ...` | `const foo = ...`（型削除） |
| `interface Props { ... }` | **削除** |
| `export const Foo = ...` | `const Foo = ...`（export削除、最後にexport default） |
| 複数ファイル | 1ファイルに統合 |

**特徴:**
- ✅ import/export文を維持（Claude Artifact形式）
- ✅ TypeScript型定義のみ削除
- ✅ 可読性の高いJSX構文
- ✅ 現在のMulti character chat.jsxと完全同一形式

---

## 🔄 ワークフロー

### 開発フロー

```bash
# 1. ローカルで開発（TypeScript）
$ vim src/components/CharacterModal.tsx

# 2. TypeScript型チェック（オプション）
$ npx tsc --noEmit

# 3. バンドル生成
$ bash scripts/bundle-to-jsx.sh
# → Multi character chat.jsx が生成される

# 4. Git コミット
$ git add src/ "Multi character chat.jsx"
$ git commit -m "feat: add character import feature"
$ git push origin claude/refactor-conversation-artifact-015UYo2L1EkiC236mKFrTevL
```

### Claude.aiでの使用

```
ユーザー → Claude.ai:
「Multi character chat.jsxをインタラクティブアーティファクトとして表示してください」
+ Multi character chat.jsx を添付

Claude.ai:
[アーティファクトが表示される]
→ すべての機能が正常に動作
```

### 更新フロー

```bash
# 1. 機能追加・修正
$ vim src/hooks/useCharacterManager.ts

# 2. ローカルで確認（オプション）
$ npm run dev  # Viteで確認

# 3. バンドル
$ bash scripts/bundle-to-jsx.sh

# 4. コミット
$ git add src/hooks/useCharacterManager.ts "Multi character chat.jsx"
$ git commit -m "fix: character deletion bug"
$ git push
```

---

## 🛠️ バンドルスクリプト（scripts/bundle-to-jsx.sh）

### 基本方針

1. src/配下のすべての.tsx/.tsファイルを読み込み
2. TypeScript型定義を削除
3. import/exportを解決して1ファイルに統合
4. Claude Artifact形式のJSXとして出力

### スクリプト例（簡易版）

```bash
#!/bin/bash

# Multi character chat.jsx 生成スクリプト

OUTPUT_FILE="Multi character chat.jsx"
TEMP_FILE="temp_bundle.jsx"

echo "Building bundle..."

# ヘッダー追加
cat > "$OUTPUT_FILE" << 'EOF'
/**
 * Multi Character Chat Application
 *
 * バンドル日時: $(date)
 * ソースファイル: src/ ディレクトリ
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AlertCircle, Trash2, Edit2, RotateCcw, Send, Plus, Eye, EyeOff, Settings, Menu, X, Hash, RefreshCw, Save, HardDrive, User, Heart, Download, Upload, ChevronDown, ChevronRight, Layers, Copy, MessageSquare, Check, Users, BookOpen, FileText, Image, History, ChevronUp, SkipForward } from 'lucide-react';

EOF

# 各セクションを追加
echo "// ========================================" >> "$OUTPUT_FILE"
echo "// Utils & Constants" >> "$OUTPUT_FILE"
echo "// ========================================" >> "$OUTPUT_FILE"
cat src/constants/index.ts | sed 's/export //g' >> "$OUTPUT_FILE"
cat src/lib/utils.ts | sed 's/export //g' >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "// ========================================" >> "$OUTPUT_FILE"
echo "// Custom Hooks" >> "$OUTPUT_FILE"
echo "// ========================================" >> "$OUTPUT_FILE"
cat src/hooks/*.ts | sed 's/export //g' | sed 's/import.*from.*//g' >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "// ========================================" >> "$OUTPUT_FILE"
echo "// Components" >> "$OUTPUT_FILE"
echo "// ========================================" >> "$OUTPUT_FILE"
cat src/components/*.tsx | sed 's/export //g' | sed 's/import.*from.*//g' >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "// ========================================" >> "$OUTPUT_FILE"
echo "// Main App Component" >> "$OUTPUT_FILE"
echo "// ========================================" >> "$OUTPUT_FILE"
cat src/App.tsx | sed 's/import.*from.*//g' >> "$OUTPUT_FILE"

echo "export default MultiCharacterChat;" >> "$OUTPUT_FILE"

echo "✅ Bundle created: $OUTPUT_FILE"
```

**注意**: 実際には、TypeScript型を適切に削除するためにBabelやTypeScriptコンパイラを使用する方が確実です。

---

## 📊 メリット・デメリット

### メリット

| 項目 | 詳細 |
|------|------|
| **開発体験** | TypeScript型チェック、分割ファイル、エディタ補完 |
| **コード品質** | 型安全性、ESLint、コードレビューが容易 |
| **可読性** | ファイル分割で各部分の責務が明確 |
| **保守性** | バグ修正・機能追加が容易 |
| **ファイルサイズ** | 250KB（現在の200KBから微増、HTMLバンドルより40%小） |
| **互換性** | 現在のMulti character chat.jsxと完全同一形式 |
| **GitHub管理** | ソースコード + バンドル両方で履歴管理 |

### デメリット

| 項目 | 詳細 | 対策 |
|------|------|------|
| **移行コスト** | 5,548行を分割する工数 | Claude.aiで自動リファクタリング |
| **バンドル手順** | 開発→バンドルのステップ増加 | スクリプト自動化 |
| **学習コスト** | TypeScript未経験者には難しい | 段階的に導入、型は最小限 |
| **二重管理** | ソースとバンドルの両方をコミット | バンドルは自動生成なので実質問題なし |

---

## 🎯 実装ステップ

### Phase 1: 初回リファクタリング（1週間）

1. **Claude.aiでリファクタリング依頼**
   ```
   「Multi character chat.jsxを以下の構造に分割してください：
   - src/types/index.ts（型定義）
   - src/hooks/（カスタムフック）
   - src/components/（UIコンポーネント）
   - src/lib/（ユーティリティ）
   - src/App.tsx（メイン）

   各ファイルの内容を返してください。」
   ```

2. **ローカルに保存**
   ```bash
   mkdir -p src/{types,hooks,components,lib,constants}
   # 各ファイルを配置
   ```

3. **Git コミット**
   ```bash
   git add src/
   git commit -m "refactor: split into TypeScript modules"
   git push
   ```

### Phase 2: バンドルスクリプト作成（2-3日）

1. **簡易バンドルスクリプト作成**
   - 手動でファイル結合
   - 型定義削除
   - import/export解決

2. **動作確認**
   - バンドル実行
   - Claude.aiで表示確認
   - 全機能テスト

3. **スクリプト改善**
   - 自動化
   - エラーハンドリング
   - 型削除の精度向上

### Phase 3: 運用開始（継続）

1. **開発フロー確立**
   - src/で開発
   - バンドル
   - Git コミット

2. **ドキュメント整備**
   - README更新
   - 開発ガイド作成

3. **継続的改善**
   - バンドル最適化
   - 型定義の充実
   - コンポーネント分割の見直し

---

## 📈 成功指標

### コード品質

- ✅ TypeScript型カバレッジ: 80%以上
- ✅ 各ファイルの行数: 300行以下
- ✅ 関数の行数: 50行以下
- ✅ コンポーネントの責務: 単一責任原則遵守

### ファイルサイズ

- ✅ バンドル後のJSX: 250-300KB
- ✅ HTMLバンドルと比較: 30-40%削減

### 開発体験

- ✅ 型エラーの早期発見
- ✅ エディタの補完機能活用
- ✅ コードレビューの容易性

---

## 🔗 関連ドキュメント

- [README.md](./README.md) - プロジェクト概要
- [REFACTORING_FUTURE_PLANS.md](./REFACTORING_FUTURE_PLANS.md) - 既存のリファクタリング計画
- [OPTIMIZATION_SUMMARY.md](./OPTIMIZATION_SUMMARY.md) - 最適化の実施結果
- [web-artifacts-builder スキル](https://github.com/anthropics/skills/tree/main/skills/web-artifacts-builder) - 参考にしたスキル

---

## 📝 更新履歴

- **2025-12-02**: ドキュメント作成、JSXバンドル型リファクタリング計画策定

---

**次のアクション**: Phase 1（初回リファクタリング）の実施
