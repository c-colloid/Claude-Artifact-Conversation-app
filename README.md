# Multi Character Chat

複数のAIキャラクターが同時に会話できるインタラクティブチャットアプリケーション

---

## 概要

Anthropic Claude APIを使用した高度なマルチキャラクター対話システムです。複数のAIキャラクターによる会話、キャラクター派生、感情システムなどを実装しています。

**技術スタック**: React 18+, Claude API, IndexedDB

---

## 主要機能

### マルチキャラクター会話
- 複数のAIキャラクターが同時に対話
- ユーザーメッセージ、キャラクターメッセージ、ナレーションの3種類をサポート
- `[CHARACTER:name]` タグでキャラクター切り替え

### キャラクター管理
- キャラクターの作成・編集・削除・複製
- **派生システム**: ベースキャラクターから設定を継承し、差分のみ定義可能
- キャラクターグループ機能で一括適用
- カスタムプロンプトによる詳細な性格設定

### 感情・好感度システム
- `[EMOTION:happy]` タグで感情表現（中立、喜び、悲しみ、怒り、驚き、恐怖）
- `[AFFECTION:+5]` タグで好感度変化
- リアルタイム感情・好感度表示

### 会話管理
- 会話の作成・削除・複製・分岐（フォーク）
- 任意のメッセージから新しい分岐を作成可能
- エクスポート/インポート機能

### データ永続化
- IndexedDB をプライマリストレージとして使用
- LocalStorage フォールバック
- 自動保存（2秒ごと、デバウンス処理）

---

## クイックスタート

1. リポジトリをクローン:
   ```bash
   git clone https://github.com/c-colloid/Claude-Artifact-Conversation-app.git
   ```

2. `Multi character chat.jsx` をClaude Artifactsで開く

---

## 開発時の注意事項

### ⚠️ 重要な制約

- **単一ファイル構成を維持**: Claude Artifactsでの実行を想定しているため、分割しない
- **段階的な変更**: 一度に大量の変更を行わず、各ステップでコミット
- **ブラケットバランスチェック**: 変更後は必ず `{}`, `()`, `[]` のバランスを確認

### 実装パターン

- **React最適化**: React.memo, useCallback, useMemoを活用（32箇所で実装済み）
- **コード構造**: 27個のグループに整理済み（State管理、定数、ヘルパー関数など）
- **エラーハンドリング**: try-catchで適切にエラーをキャッチし、ユーザーにフィードバック

### ブラケットバランスチェック方法

```bash
python3 << 'EOF'
file_path = "Multi character chat.jsx"
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()
braces = content.count('{') - content.count('}')
parens = content.count('(') - content.count(')')
brackets = content.count('[') - content.count(']')
print(f"Braces: {braces}, Parens: {parens}, Brackets: {brackets}")
# All should be 0
EOF
```

### 推奨される変更フロー

1. 変更前にgit commit（バックアップ）
2. 小さな変更を実施
3. ブラケットバランスチェック
4. 動作確認（可能であればブラウザで実行）
5. git commit
6. 次の変更へ

---

## ドキュメント

| ドキュメント | 説明 |
|------------|------|
| **[OPTIMIZATION_SUMMARY.md](./OPTIMIZATION_SUMMARY.md)** | Phase 1-5の実施結果と最適化の成果 |
| **[REFACTORING_FUTURE_PLANS.md](./REFACTORING_FUTURE_PLANS.md)** | 未実施タスクと実施計画 |
| **[PHASE5_EARLY_RETURN_CANDIDATES.md](./PHASE5_EARLY_RETURN_CANDIDATES.md)** | Early Return候補の詳細 |

**完了した最適化について** → [OPTIMIZATION_SUMMARY.md](./OPTIMIZATION_SUMMARY.md)
**今後のタスクを確認** → [REFACTORING_FUTURE_PLANS.md](./REFACTORING_FUTURE_PLANS.md)

---

## ライセンス

MITライセンス - 詳細は [LICENSE](./LICENSE) を参照

---

**最終更新**: 2025-11-20
