# Multi Character Chat

複数のAIキャラクターが同時に会話できるインタラクティブチャットアプリケーション

---

## 概要

Anthropic Claude APIを使用した高度なマルチキャラクター対話システムです。複数のAIキャラクターによる会話、キャラクター派生、感情システムなどを実装しています。

**主な技術**: React 18+, Claude API, IndexedDB

---

## 主要機能

- 🎭 **マルチキャラクター会話** - 複数のAIキャラクターが同時に対話
- 🧬 **キャラクター派生システム** - ベースキャラクターから新しいキャラクターを作成
- 😊 **感情・好感度システム** - 動的な感情表現と関係性管理
- 🔄 **メッセージバージョニング** - 会話の分岐と履歴管理
- 💾 **データ永続化** - IndexedDB/LocalStorageによる自動保存
- ⚡ **パフォーマンス最適化** - React.memo, useCallback, useMemoによる高速化

---

## クイックスタート

1. リポジトリをクローン:
   ```bash
   git clone https://github.com/c-colloid/Claude-Artifact-Conversation-app.git
   ```

2. `Multi character chat.jsx` をClaude Artifactsで開く、またはReactプロジェクトに統合

3. Anthropic API キーを設定して使用開始

---

## ドキュメント

| ドキュメント | 説明 |
|------------|------|
| **[OPTIMIZATION_SUMMARY.md](./OPTIMIZATION_SUMMARY.md)** | Phase 1-5の実施結果と最適化の成果 |
| **[REFACTORING_FUTURE_PLANS.md](./REFACTORING_FUTURE_PLANS.md)** | 未実施タスクと実施計画 |
| **[PHASE5_EARLY_RETURN_CANDIDATES.md](./PHASE5_EARLY_RETURN_CANDIDATES.md)** | Early Return候補の詳細 |

**完了した最適化について知りたい** → [OPTIMIZATION_SUMMARY.md](./OPTIMIZATION_SUMMARY.md)
**今後のタスクを確認したい** → [REFACTORING_FUTURE_PLANS.md](./REFACTORING_FUTURE_PLANS.md)

---

## プロジェクト情報

- **ファイル**: `Multi character chat.jsx` (4,612行)
- **最適化済み項目**: 117項目（React最適化、コード構造化、重複削除など）
- **パフォーマンス向上**: 30-50%（Phase 1）
- **可読性・保守性**: ★★★★★

詳細は [OPTIMIZATION_SUMMARY.md](./OPTIMIZATION_SUMMARY.md) を参照してください。

---

## ライセンス

MITライセンス - 詳細は [LICENSE](./LICENSE) を参照

---

**最終更新**: 2025-11-20
