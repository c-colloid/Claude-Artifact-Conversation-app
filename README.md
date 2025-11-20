# Multi Character Chat - Claude Artifact Conversation App

マルチキャラクター対話システム - Anthropic Claude APIを活用した高度な会話アプリケーション

---

## 📖 概要

このプロジェクトは、複数のAIキャラクターが同時に会話できる革新的なチャットアプリケーションです。Claude APIを使用し、キャラクターの派生、感情システム、好感度システムなど、高度な機能を実装しています。

**主な特徴**:
- 🎭 複数キャラクターによる同時会話
- 🧬 キャラクター派生システム（ベースキャラクターからの派生）
- 😊 感情・好感度システム
- 🔄 メッセージバージョニング・分岐機能
- 💾 IndexedDB / LocalStorage による永続化
- ⚡ React 18+によるパフォーマンス最適化
- 🤔 Extended Thinking サポート

---

## ✨ 主要機能

### 1. マルチキャラクター会話
- 複数のAIキャラクターが同時に会話
- ナレーション機能
- ユーザーメッセージとキャラクターメッセージの区別

### 2. キャラクター管理
- キャラクターの作成・編集・削除
- キャラクターグループ機能
- ベースキャラクターからの派生
- カスタムプロンプト設定

### 3. 感情・好感度システム
- リアルタイム感情表示（中立、喜び、悲しみ、怒り、驚き、恐怖）
- 好感度レベル（0-100）
- 感情タグによる動的表現

### 4. 会話管理
- 会話の作成・削除・複製・分岐
- タイトルの編集
- エクスポート/インポート機能
- 統計情報（メッセージ数、キャラクター数、最終更新日）

### 5. メッセージ機能
- メッセージの編集・削除・再生成
- メッセージバージョニング
- 分岐（フォーク）機能
- スムーズスクロール

### 6. データ永続化
- IndexedDB による高速ストレージ
- LocalStorage フォールバック
- 自動保存（2秒ごと）
- データのエクスポート/インポート

---

## 🛠 技術スタック

- **フロントエンド**: React 18+
- **状態管理**: React Hooks (useState, useCallback, useMemo, useEffect)
- **API**: Anthropic Claude API
- **ストレージ**: IndexedDB, LocalStorage
- **スタイリング**: Tailwind CSS（想定）
- **パフォーマンス最適化**: React.memo, useCallback, useMemo

---

## 📂 ドキュメント構造

このプロジェクトには、詳細なドキュメントが用意されています：

### 主要ドキュメント

| ドキュメント | 説明 | 行数 |
|------------|------|------|
| **[README.md](./README.md)** | プロジェクト概要（このファイル） | ~200 |
| **[OPTIMIZATION_SUMMARY.md](./OPTIMIZATION_SUMMARY.md)** | Phase 1-5の実施結果総括 | 447 |
| **[REFACTORING_FUTURE_PLANS.md](./REFACTORING_FUTURE_PLANS.md)** | 未実施タスクと実施計画 | 490 |
| **[PHASE5_EARLY_RETURN_CANDIDATES.md](./PHASE5_EARLY_RETURN_CANDIDATES.md)** | Early Return候補箇所の詳細 | 717 |

### ドキュメントナビゲーション

**完了済みの最適化について知りたい場合**:
→ [OPTIMIZATION_SUMMARY.md](./OPTIMIZATION_SUMMARY.md)

**今後の実施タスクを確認したい場合**:
→ [REFACTORING_FUTURE_PLANS.md](./REFACTORING_FUTURE_PLANS.md)

**Early Return の詳細な候補箇所を知りたい場合**:
→ [PHASE5_EARLY_RETURN_CANDIDATES.md](./PHASE5_EARLY_RETURN_CANDIDATES.md)

---

## 🚀 最適化の成果

### 実施済みフェーズ

| Phase | 状態 | 主な成果 |
|-------|------|---------|
| **Phase 1** | ✅ 完了 | React最適化（30-50%性能向上） |
| **Phase 2.5** | ✅ 完了 | コード構造整理（可読性★★★★★） |
| **Phase 3** | 🟡 部分完了 | 重複削除（33箇所共通化） |
| **Phase 4** | 🟡 部分完了 | 式の簡略化（24箇所） |
| **Phase 5** | 🟡 部分完了 | 条件式最適化（1箇所、+10候補） |

### 総合統計

- **総最適化数**: 117項目
- **コミット数**: 23回
- **ファイルサイズ**: 4,093行 → 4,612行（+12.7%）
  - 主にReact最適化コードとグループ化コメントによる増加
  - 実質的なコード削減: 18行
- **パフォーマンス向上**: 30-50%（レンダリング）
- **可読性**: ★★★★★
- **保守性**: ★★★★★

詳細: [OPTIMIZATION_SUMMARY.md](./OPTIMIZATION_SUMMARY.md)

---

## 🎯 クイックスタート

### 前提条件

- Node.js 16+ または最新のモダンブラウザ
- Anthropic API キー（Claude API）

### インストール

このプロジェクトは単一の `.jsx` ファイルとして設計されています。

1. リポジトリをクローン:
   ```bash
   git clone https://github.com/c-colloid/Claude-Artifact-Conversation-app.git
   cd Claude-Artifact-Conversation-app
   ```

2. Claude Artifacts で開く、またはReactプロジェクトに統合

### 使用方法

1. **APIキーの設定**
   - アプリケーションを開く
   - 設定からAnthropic API キーを入力

2. **キャラクターの作成**
   - 「キャラクター管理」ボタンをクリック
   - 「新規キャラクター追加」でキャラクターを作成
   - 名前、性格、話し方などを設定

3. **会話の開始**
   - メインエリアでメッセージを入力
   - 「送信」ボタンまたはCtrl+Enterで送信
   - キャラクターが自動的に応答

4. **高度な機能**
   - **派生キャラクター**: 既存キャラクターをベースに新しいキャラクターを作成
   - **感情システム**: `[EMOTION:happy]` などのタグで感情を表現
   - **好感度**: キャラクターとの関係性をレベルで管理
   - **会話の分岐**: 任意のメッセージから新しい分岐を作成

---

## 📊 ファイル構成

```
Claude-Artifact-Conversation-app/
├── README.md                              # プロジェクト概要
├── OPTIMIZATION_SUMMARY.md                # 最適化総括
├── REFACTORING_FUTURE_PLANS.md            # 未実施タスク
├── PHASE5_EARLY_RETURN_CANDIDATES.md      # Early Return候補
├── Multi character chat.jsx               # メインアプリケーション（4,612行）
├── Character Chat.jsx                     # 単一キャラクターチャット
└── LICENSE                                # ライセンス
```

---

## 🔧 開発情報

### ファイル情報

- **メインファイル**: `Multi character chat.jsx`
- **現在の行数**: 4,612行
- **コンポーネント数**: 9（メイン + 8サブコンポーネント）
- **State変数**: 30+
- **React最適化**: 32個（memo/useCallback/useMemo）
- **コード構造グループ**: 27個

### アーキテクチャ

```
MultiCharacterChat (メインコンポーネント)
├── State管理 (10グループ)
├── Refs (5個)
├── 定数定義 (5グループ)
├── ヘルパー関数 (3グループ)
├── Memoized値 (2グループ)
├── イベントハンドラー (4グループ)
├── 副作用 (3グループ)
└── サブコンポーネント
    ├── AvatarDisplay
    ├── ConfirmDialog
    ├── EmojiPicker
    ├── ImageCropper
    ├── MessageBubble
    ├── ConversationListItem
    ├── ConversationSettingsPanel
    └── CharacterModal
```

### Gitブランチ

- **メインブランチ**: `main`
- **現在の作業ブランチ**: `claude/optimize-documentation-0179PKFV6TVGirC6YkWhuTN7`

---

## 🤝 貢献

このプロジェクトは現在開発中です。貢献を歓迎します！

### 貢献方法

1. このリポジトリをフォーク
2. フィーチャーブランチを作成（`git checkout -b feature/amazing-feature`）
3. 変更をコミット（`git commit -m 'Add amazing feature'`）
4. ブランチにプッシュ（`git push origin feature/amazing-feature`）
5. プルリクエストを作成

### 開発ガイドライン

- 単一ファイル構成を維持
- 段階的な変更（各ステップでコミット）
- ブラケットバランスチェックを実施
- [REFACTORING_FUTURE_PLANS.md](./REFACTORING_FUTURE_PLANS.md)の実装チェックリストに従う

---

## 📝 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は [LICENSE](./LICENSE) ファイルを参照してください。

---

## 🙏 謝辞

- **Anthropic**: Claude API の提供
- **React Team**: 素晴らしいフレームワーク
- コミュニティの皆様

---

## 📮 連絡先

プロジェクトに関する質問や提案がある場合は、GitHubのIssuesセクションでお知らせください。

---

**最終更新**: 2025-11-20
**バージョン**: Phase 1-5 部分完了版
