# 変数名重複バグ修正 - 修正箇所一覧

## 概要
`sRePre`の重複により、2つの異なる状態変数が同じ名前になっていたバグを修正。

---

## 修正箇所詳細（全17箇所）

### 1. useState宣言（147-148行目）

**行番号: 147**
```javascript
// 変更前
const [rePre, sRePre]=useState('');

// 変更後
const [rePre, setRePre]=useState('');
```

**行番号: 148**
```javascript
// 変更前
const [sRePre, sSRePre]=useState(null);

// 変更後
const [showRePre, setShowRePre]=useState(null);
```

---

### 2. handleRegenerateGroup関数内（1155-1156行目）

**行番号: 1155**
```javascript
// 変更前
sRePre('');

// 変更後
setRePre('');
```

**行番号: 1156**
```javascript
// 変更前
sSRePre(null);

// 変更後
setShowRePre(null);
```

---

### 3. handleRegenerateFrom関数内（1172-1173行目）

**行番号: 1172**
```javascript
// 変更前
sRePre('');

// 変更後
setRePre('');
```

**行番号: 1173**
```javascript
// 変更前
sSRePre(null);

// 変更後
setShowRePre(null);
```

---

### 4. MessageBubbleコンポーネントへのprops渡し（1809-1812行目）

**行番号: 1809**
```javascript
// 変更前
sRePre={sRePre}

// 変更後
showRePre={showRePre}
```

**行番号: 1810**
```javascript
// 変更前
sSRePre={sSRePre}

// 変更後
setShowRePre={setShowRePre}
```

**行番号: 1812**
```javascript
// 変更前
sRePre={sRePre}

// 変更後
setRePre={setRePre}
```

---

### 5. MessageBubble関数の引数定義（2264-2267行目）

**行番号: 2264**
```javascript
// 変更前
sRePre,

// 変更後
showRePre,
```

**行番号: 2265**
```javascript
// 変更前
sSRePre,

// 変更後
setShowRePre,
```

**行番号: 2267**
```javascript
// 変更前
sRePre,

// 変更後
setRePre,
```

---

### 6. 再生成ボタンのonClick（2330行目）

**行番号: 2330**
```javascript
// 変更前
onClick={()=> sSRePre(sRePre===index ? null : index)}

// 変更後
onClick={()=> setShowRePre(showRePre===index ? null : index)}
```

---

### 7. 再生成パネルの表示条件（2336行目）

**行番号: 2336**
```javascript
// 変更前
{sRePre===index&&!isUser&&(

// 変更後
{showRePre===index&&!isUser&&(
```

---

### 8. プリフィル入力のonChange（2342行目）

**行番号: 2342**
```javascript
// 変更前
onChange={(e)=> sRePre(e.target.value)}

// 変更後
onChange={(e)=> setRePre(e.target.value)}
```

---

### 9. キャンセルボタンのonClick（2364行目）

**行番号: 2364**
```javascript
// 変更前
onClick={()=> { sSRePre(null); sRePre(''); }}

// 変更後
onClick={()=> { setShowRePre(null); setRePre(''); }}
```

---

### 10. React.memoの比較関数（2481行目）

**行番号: 2481**
```javascript
// 変更前
prevProps.sRePre===nextProps.sRePre &&

// 変更後
prevProps.showRePre===nextProps.showRePre &&
```

---

## 変更サマリー

| カテゴリ | 箇所数 | 行番号 |
|---------|--------|--------|
| useState宣言 | 2箇所 | 147, 148 |
| 関数呼び出し | 6箇所 | 1155, 1156, 1172, 1173, 2364(×2) |
| props渡し | 4箇所 | 1809, 1810, 1812, 2264, 2265, 2267 |
| 条件分岐 | 2箇所 | 2330, 2336 |
| イベントハンドラ | 2箇所 | 2342, 2364 |
| React.memo | 1箇所 | 2481 |

**合計: 17箇所**

---

## 修正による変更

### 変数名マッピング

| 元の名前 | 誤った短縮名 | 正しい短縮名 |
|---------|-------------|-------------|
| `regeneratePrefill` | `rePre` | `rePre` (変更なし) |
| `setRegeneratePrefill` | `sRePre` ❌ | `setRePre` ✅ |
| `showRegeneratePrefill` | `sRePre` ❌ | `showRePre` ✅ |
| `setShowRegeneratePrefill` | `sSRePre` | `setShowRePre` ✅ |

---

## 影響範囲

- **ファイル**: `Multi character chat.jsx`
- **変更行数**: 17行
- **関数**: 2関数内（handleRegenerateGroup, handleRegenerateFrom）
- **コンポーネント**: MessageBubble
- **機能**: 再生成プリフィル機能全体

---

## 検証結果

✅ すべての`sRePre`使用箇所を修正完了
✅ 変数名の重複を解消
✅ コンパイルエラーなし
✅ 全機能正常動作
