import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AlertCircle, Trash2, Edit2, RotateCcw, Send, Plus, Eye, EyeOff, Settings, Menu, X, Hash, RefreshCw, Save, HardDrive, User, Heart, Download, Upload, ChevronDown, ChevronRight, Layers, Copy, MessageSquare, Check, Users, BookOpen, FileText, Image, History, ChevronUp, SkipForward } from 'lucide-react';
const debounce=(func, delay)=> {
let timeoutId;
return(...args)=> {
clearTimeout(timeoutId);
timeoutId=setTimeout(()=> func(...args), delay);
};
};
const throttle=(func, limit)=> {
let inThrottle;
return(...args)=> {
if(!inThrottle) {
func(...args);
inThrottle=true;
setTimeout(()=> inThrottle=false, limit);
}
};
};
const compressImage=async (file, maxSize=200, quality=0.7)=> {
return new Promise((resolve, reject)=> {
const reader=new FileReader();
reader.onload=(e)=> {
const img=new window.Image();
img.onload=()=> {
 const canvas=document.createElement('canvas');
 let width=img.width;
 let height=img.height;
 if(width > height) {
 if(width > maxSize) {
  height *=maxSize/width;
  width=maxSize;
 }
 } else {
 if(height > maxSize) {
  width *=maxSize/height;
  height=maxSize;
 }
 }
 canvas.width=width;
 canvas.height=height;
 const ctx=canvas.getContext('2d');
 ctx.drawImage(img, 0, 0, width, height);
 const mimeType=canvas.toDataURL('image/webp').indexOf('data:image/webp')===0
 ? 'image/webp'
 : 'image/jpeg';
 const compressedDataUrl=canvas.toDataURL(mimeType, quality);
 resolve(compressedDataUrl);
};
img.onerror=()=> {
 reject(new Error('画像の読み込みに失敗しました'));
};
img.src=e.target.result;
};
reader.onerror=()=> {
reject(new Error('ファイルの読み込みに失敗しました'));
};
reader.readAsDataURL(file);
});
};
const IDB={
DB_NAME: 'MCCDB',
DB_VERSION: 1,
STORE_NAME: 'app',
dbInstance: null,
openDB: function() {
if(this.dbInstance) {
return Promise.resolve(this.dbInstance);
}
return new Promise((resolve, reject)=> {
const request=indexedDB.open(this.DB_NAME, this.DB_VERSION);
request.onerror=()=> {
 reject(new Error('IndexedDBを開けませんでした'));
};
request.onsuccess=()=> {
 this.dbInstance=request.result;
 resolve(this.dbInstance);
};
request.onupgradeneeded=(event)=> {
 const db=event.target.result;
 if(!db.objectStoreNames.contains(this.STORE_NAME)) {
 const objectStore=db.createObjectStore(this.STORE_NAME, { keyPath: 'key' });
 objectStore.createIndex('ts', 'ts', { unique: false });
 }
};
});
},
executeTransaction: async function(mode, operation, errorMsg, processResult) {
const db=await this.openDB();
return new Promise((resolve, reject)=> {
const transaction=db.transaction([this.STORE_NAME], mode);
const objectStore=transaction.objectStore(this.STORE_NAME);
const request=operation(objectStore);
request.onsuccess=()=> resolve(processResult ? processResult(request.result) : undefined);
request.onerror=()=> reject(new Error(errorMsg));
});
},
setItem: async function(key, value) {
return this.executeTransaction('readwrite',
(store)=> store.put({ key, value, ts: getTs() }),
'データの保存に失敗しました'
);
},
getItem: async function(key) {
return this.executeTransaction('readonly',
(store)=> store.get(key),
'データの読み込みに失敗しました',
(result)=> result ? result.value : null
);
},
removeItem: async function(key) {
return this.executeTransaction('readwrite',
(store)=> store.delete(key),
'データの削除に失敗しました'
);
},
clear: async function() {
return this.executeTransaction('readwrite',
(store)=> store.clear(),
'データのクリアに失敗しました'
);
},
};
const MultiCharacterChat=()=> {
const [inited, sInited]=useState(false);
const [characters, sChars]=useState([]);
const [charGrps, sCharGrps]=useState([]);
const [showCharMod, sShowCharMod]=useState(false);
const [conversations, sConvs]=useState([]);
const [curConvId, sCurConvId]=useState(null);
const [prompt, sPrompt]=useState('');
const [messageType, sMsgType]=useState('user');
const [nextSpeaker, sNextSpk]=useState(null);
const [prefillText, sPrefill]=useState('');
const [loading, sLoading]=useState(false);
const [error, sErr]=useState('');
const [models, setMdls]=useState([]);
const [model, setMdl]=useState('claude-sonnet-4-5-20250929');
const [loadMdls, sLoadMdls]=useState(false);
const [thinkEn, sThinkEn]=useState(false);
const [thinkBdg, sThinkBdg]=useState(2000);
const [showThinking, sShowThink]=useState({});
const [editIdx, sEditIdx]=useState(null);
const [editCont, sEditCont]=useState('');
const [editEmo, sEditEmo]=useState(null);
const [editAff, sEditAff]=useState(null);
const [regenPre, sRegenPre]=useState('');
const [showRegenPre, sShowRegenPre]=useState(null);
const [editConvTitle, sEditConvTitle]=useState(null);
const [editTitle, sEditTitle]=useState('');
const [showVers, sShowVer]=useState({});
const [stats, sStats]=useState({
inTok: 0,
outTok: 0,
totTok: 0,
reqCnt: 0
});
const [autoSave, sAutoSave]=useState(true);
const [saved, sSaved]=useState(null);
const [saveState, sSaveState]=useState('');
const [showSet, sShowSet]=useState(false);
const [showSide, sShowSide]=useState(false);
const [sideView, sSideView]=useState('conversations');
const [showConvSet, sShowConvSet]=useState(false);
const [visMsgCnt, sVisMsgCnt]=useState(100);
const [confirmDlg, sConfirmDlg]=useState(null);
const msgEndRef=useRef(null);
const charFileRef=useRef(null);
const convFileRef=useRef(null);
const msgRefs=useRef({});
const txtRef=useRef(null);
const MSG_INC=50;
const STORE_KEY='mcc-v1';
const SAVE_DELAY=2000;
const MAX_IMG=2*1024*1024;
const fallbackModels=[
{ id: 'claude-opus-4-1-20250805', name: 'Opus 4.1', icon: '👑' },
{ id: 'claude-opus-4-20250514', name: 'Opus 4', icon: '💎' },
{ id: 'claude-sonnet-4-5-20250929', name: 'Sonnet 4.5', icon: '⭐' },
{ id: 'claude-sonnet-4-20250514', name: 'Sonnet 4', icon: '✨' },
{ id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5', icon: '⚡' },
{ id: 'claude-haiku-4-20250514', name: 'Haiku 4', icon: '💨' }
];
const emotions={
joy: { label: '喜', emoji: '😊', color: 'text-yellow-500' },
anger: { label: '怒', emoji: '😠', color: 'text-red-500' },
sadness: { label: '哀', emoji: '😢', color: 'text-blue-500' },
fun: { label: '楽', emoji: '😆', color: 'text-green-500' },
embarrassed: { label: '照', emoji: '😳', color: 'text-pink-500' },
surprised: { label: '驚', emoji: '😲', color: 'text-purple-500' },
neutral: { label: '中', emoji: '😐', color: 'text-gray-500' }
};
const genId=()=>Date.now().toString(36)+Math.random().toString(36).substr(2);
const getTs=()=> new Date().toISOString();
const getDate=()=> new Date().toISOString().slice(0, 10);
const mkTs=()=> ({
cre: getTs(),
upd: getTs()
});
const genFile=(prefix, name)=> {
return `${prefix}_${name}_${getDate()}.json`;
};
const getIconForModel=(dispName, modelId)=> {
const name=(dispName||modelId).toLowerCase();
if(name.includes('opus')) return '👑';
if(name.includes('sonnet')) return '⭐';
if(name.includes('haiku')) return '⚡';
return '🤖';
};
const getShortName=(dispName, modelId)=> {
if(dispName) {
return dispName.replace('Claude ', '');
}
if(modelId.includes('opus')) {
if(modelId.includes('4-1')) return 'Opus 4.1';
if(modelId.includes('4')) return 'Opus 4';
}
if(modelId.includes('sonnet')) {
if(modelId.includes('4-5')) return 'Sonnet 4.5';
if(modelId.includes('4')) return 'Sonnet 4';
}
if(modelId.includes('haiku')) {
if(modelId.includes('4-5')) return 'Haiku 4.5';
if(modelId.includes('4')) return 'Haiku 4';
}
return modelId;
};
const getDefaultCharacter=()=> ({
id: genId(),
name: '新しいキャラクター',
baseCharacterId: null,
overrides: {},
definition: {
pers: 'フレンドリーで親切',
speakingStyle: '丁寧な口調',
firstPerson: '私',
secondPerson: 'あなた',
background: '',
phrases: [],
custPrompt: ''
},
features: {
emoOn: true,
affOn: true,
autoEmo: true,
autoAff: true,
curEmo: 'neutral',
affLvl: 50,
avatar: '😊',
avType: 'emoji',
avatImg: null
},
...mkTs()
});
const getDefaultConversation=()=> ({
id: genId(),
title: '新しい会話',
partIds: [],
backgroundInfo: '',
narrOn: true,
autoGenerateNarration: false,
relationships: [],
parentConversationId: null,
forkPoint: null,
messages: [],
...mkTs()
});
const getCurConv=useMemo(()=> {
return conversations.find(c=> c.id===curConvId);
}, [conversations, curConvId]);
const getAllMsgs=useMemo(()=> {
if(!getCurConv) return [];
return getCurConv.messages||[];
}, [getCurConv]);
const getVisibleMessages=useMemo(()=> {
if(getAllMsgs.length <=visMsgCnt) {
return getAllMsgs;
}
return getAllMsgs.slice(-visMsgCnt);
}, [getAllMsgs, visMsgCnt]);
const getCurMsgs=getAllMsgs;
const getCharById=useCallback((id)=> {
return characters.find(c=> c.id===id);
}, [characters]);
const getEffectiveCharacter=useCallback((character)=> {
if(!character) return null;
if(!character.baseCharacterId) {
return character;
}
const baseChar=getCharById(character.baseCharacterId);
if(!baseChar) {
return character;
}
const effectiveBase=getEffectiveCharacter(baseChar);
const merged={
...character,
definition: {
 pers: character.overrides.pers ? character.definition.pers : effectiveBase.definition.pers,
 speakingStyle: character.overrides.speakingStyle ? character.definition.speakingStyle : effectiveBase.definition.speakingStyle,
 firstPerson: character.overrides.firstPerson ? character.definition.firstPerson : effectiveBase.definition.firstPerson,
 secondPerson: character.overrides.secondPerson ? character.definition.secondPerson : effectiveBase.definition.secondPerson,
 background: character.overrides.background ? character.definition.background : effectiveBase.definition.background,
 phrases: character.overrides.phrases ? character.definition.phrases : effectiveBase.definition.phrases,
 custPrompt: character.overrides.custPrompt ? character.definition.custPrompt : effectiveBase.definition.custPrompt
},
features: {
 emoOn: character.overrides.emoOn !==undefined ? character.features.emoOn : effectiveBase.features.emoOn,
 affOn: character.overrides.affOn !==undefined ? character.features.affOn : effectiveBase.features.affOn,
 autoEmo: character.overrides.autoEmo !==undefined ? character.features.autoEmo : effectiveBase.features.autoEmo,
 autoAff: character.overrides.autoAff !==undefined ? character.features.autoAff : effectiveBase.features.autoAff,
 curEmo: character.overrides.curEmo ? character.features.curEmo : effectiveBase.features.curEmo,
 affLvl: character.overrides.affLvl !==undefined ? character.features.affLvl : effectiveBase.features.affLvl,
 avatar: character.overrides.avatar ? character.features.avatar : effectiveBase.features.avatar
}
};
return merged;
}, [getCharById]);
const parseMultiCharacterResponse=(responseText, conversation, thinkCont, respGrpId=null)=> {
const messages=[];
const characterUpdates={};
const lines=responseText.split('\n');
let currentType=null;
let currentCharacterId=null;
let currentContent=[];
let thinkingAdded=false;
const finishCurrentMessage=()=> {
if(currentContent.length > 0) {
 let content=currentContent.join('\n').trim();
 let emotion=null;
 let affection=null;
 if(content) {
 const emotionMatch=content.match(/\[EMOTION:(\w+)\]/);
 if(emotionMatch&&emotions[emotionMatch[1]]) {
  emotion=emotionMatch[1];
  content=content.replace(/\[EMOTION:\w+\]/, '').trim();
 }
 const affectionMatch=content.match(/\[AFFECTION:(\d+)\]/);
 if(affectionMatch) {
  const value=parseInt(affectionMatch[1]);
  affection=Math.max(0, Math.min(100, value));
  content=content.replace(/\[AFFECTION:\d+\]/, '').trim();
 }
 if(currentCharacterId&&(emotion||affection !==null)) {
  if(!characterUpdates[currentCharacterId]) {
  characterUpdates[currentCharacterId]={};
  }
  if(emotion) {
  characterUpdates[currentCharacterId].emotion=emotion;
  }
  if(affection !==null) {
  characterUpdates[currentCharacterId].affection=affection;
  }
 }
 const messageId=genId();
 const ts=getTs();
 messages.push({
  id: messageId,
  role: 'assistant',
  type: currentType||'character',
  characterId: currentCharacterId,
  content: content,
  emotion: emotion,
  affection: affection,
  thinking: !thinkingAdded&&thinkCont ? thinkCont : '',
  ts: ts,
  respGrpId: respGrpId,
  alternatives: [{
  id: genId(),
  content: content,
  emotion: emotion,
  affection: affection,
  thinking: !thinkingAdded&&thinkCont ? thinkCont : '',
  ts: ts,
  isActive: true
  }]
 });
 thinkingAdded=true;
 }
}
currentContent=[];
};
for(const line of lines) {
const charMatch=line.match(/^\[CHARACTER:([^\]]+)\]/);
if(charMatch) {
 finishCurrentMessage();
 const charName=charMatch[1].trim();
 const char=conversation.partIds
 .map(id=> getCharById(id))
 .find(c=> c?.name===charName);
 currentType='character';
 currentCharacterId=char?.id ?? null;
 const restOfLine=line.replace(/^\[CHARACTER:[^\]]+\]\s*/, '');
 if(restOfLine) {
 currentContent.push(restOfLine);
 }
 continue;
}
const narrationMatch=line.match(/^\[NARRATION\]/);
if(narrationMatch) {
 finishCurrentMessage();
 currentType='narration';
 currentCharacterId=null;
 const restOfLine=line.replace(/^\[NARRATION\]\s*/, '');
 if(restOfLine) {
 currentContent.push(restOfLine);
 }
 continue;
}
currentContent.push(line);
}
finishCurrentMessage();
if(messages.length===0) {
const anyCharMatch=responseText.match(/\[CHARACTER:([^\]]+)\]/);
let characterId=null;
let messageType='character';
if(anyCharMatch) {
 const charName=anyCharMatch[1].trim();
 const char=conversation.partIds
 .map(id=> getCharById(id))
 .find(c=> c?.name===charName);
 characterId=char?.id ?? null;
}
let cleanContent=responseText.replace(/\[CHARACTER:[^\]]+\]|\[NARRATION\]|\[EMOTION:\w+\]|\[AFFECTION:\d+\]/g, '').trim();
const messageId=genId();
const ts=getTs();
messages.push({
 id: messageId,
 role: 'assistant',
 type: messageType,
 characterId: characterId,
 content: cleanContent,
 thinking: thinkCont,
 ts: ts,
 respGrpId: respGrpId,
 alternatives: [{
 id: genId(),
 content: cleanContent,
 emotion: null,
 affection: null,
 thinking: thinkCont,
 ts: ts,
 isActive: true
 }]
});
}
return { messages, characterUpdates };
};
const updChar=useCallback((characterId, updates)=> {
sChars(chars=> chars.map(c=>
c.id===characterId
 ? { ...c, ...updates, upd: getTs() }
 : c
));
}, []);
const updConv=useCallback((conversationId, updates)=> {
sConvs(prev=> prev.map(conv=>
conv.id===conversationId
 ? { ...conv, ...updates, upd: getTs() }
 : conv
));
}, []);
const participantCharacters=useMemo(()=> {
if(!getCurConv) return [];
return getCurConv.partIds
.map(id=> getCharById(id))
.map(c=> getEffectiveCharacter(c))
.filter(c=> c);
}, [getCurConv, getCharById, getEffectiveCharacter]);
const sortedConversations=useMemo(()=> {
return [...conversations].sort((a, b)=> new Date(b.upd)-new Date(a.upd));
}, [conversations]);
const buildSystemPrompt=useCallback((conversation, nextSpeakerId=null, messages=[])=> {
if(!conversation) return '';
const participants=conversation.partIds
.map(id=> getCharById(id))
.map(c=> getEffectiveCharacter(c))
.filter(c=> c);
if(participants.length===0) return '';
let prompt=`# マルチキャラクター会話システム\n\n`;
prompt +=`この会話には以下のキャラクターが参加しています:\n\n`;
participants.forEach((char, idx)=> {
const def=char.definition;
const feat=char.features;
prompt +=`## ${idx+1}. ${char.name}\n`;
prompt +=`- 性格: ${def.pers}\n`;
prompt +=`- 話し方: ${def.speakingStyle}\n`;
prompt +=`- 一人称: ${def.firstPerson}\n`;
prompt +=`- 二人称: ${def.secondPerson}\n`;
if(def.background) prompt +=`- 背景: ${def.background}\n`;
if(def.phrases&&def.phrases.length > 0) {
 prompt +=`- 口癖: ${def.phrases.join('、')}\n`;
}
if(feat.emoOn) {
 prompt +=`- 現在の感情: ${emotions[feat.curEmo]?.label||'中立'}\n`;
}
if(feat.affOn) {
 prompt +=`- 現在の好感度: ${feat.affLvl}/100\n`;
}
if(def.custPrompt) {
 prompt +=`\n### 追加設定\n${def.custPrompt}\n`;
}
prompt +=`\n`;
});
if(conversation.backgroundInfo) {
prompt +=`## 背景情報・シチュエーション\n${conversation.backgroundInfo}\n\n`;
}
if(conversation.relationships&&conversation.relationships.length > 0) {
prompt +=`## キャラクター間の関係性\n`;
conversation.relationships.forEach((rel)=> {
 const char1=rel.char1Id==='__user__' ? { name: 'ユーザー' } : participants.find(c=> c.id===rel.char1Id);
 const char2=rel.char2Id==='__user__' ? { name: 'ユーザー' } : participants.find(c=> c.id===rel.char2Id);
 if(char1&&char2) {
 prompt +=`- ${char1.name} と ${char2.name}: ${rel.type}`;
 if(rel.desc) {
  prompt +=` (${rel.desc})`;
 }
 prompt +=`\n`;
 }
});
prompt +=`\n`;
}
prompt +=`## 重要な指示\n\n`;
prompt +=`**タグの使用は必須です。以下のルールを厳密に守ってください:**\n\n`;
if(nextSpeakerId) {
const nextChar=participants.find(c=> c.id===nextSpeakerId);
if(nextChar) {
 prompt +=`1. **次は${nextChar.name}として発言してください**\n`;
 prompt +=`2. **[CHARACTER:${nextChar.name}] タグを行の先頭に必ず出力してください**\n`;
 prompt +=`  -タグの後に改行してから発言内容を書いてください\n`;
 prompt +=`  -タグと発言内容を同じ行に書かないでください\n`;
}
} else {
prompt +=`1. 次に発言すべきキャラクターを判断し、そのキャラクターとして発言してください\n`;
prompt +=`2. **[CHARACTER:キャラクター名] タグを行の先頭に必ず出力してください**\n`;
prompt +=`  -タグの後に改行してから発言内容を書いてください\n`;
prompt +=`  -タグと発言内容を同じ行に書かないでください\n`;
}
prompt +=`3. **複数のキャラクターが発言する場合**\n`;
prompt +=`  -各キャラクターの発言の前に必ず [CHARACTER:キャラクター名] タグを付けてください\n`;
prompt +=`  -キャラクター間の発言は空行で区切ってください\n`;
prompt +=`4. 各キャラクターの個性を維持し、自然な会話の流れを作ってください\n`;
prompt +=`5. 一人称・二人称は各キャラクターの設定に従ってください\n`;
const hasAutoEmotion=participants.some(c=> c.features.emoOn&&c.features.autoEmo);
const hasAutoAffection=participants.some(c=> c.features.affOn&&c.features.autoAff);
if(hasAutoEmotion) {
prompt +=`5. 感情表現: 会話の流れに応じて、発言の最後に [EMOTION:感情キー] を出力してください\n`;
prompt +=`   利用可能な感情: ${Object.keys(emotions).join(', ')}\n`;
}
if(hasAutoAffection) {
const affectionNum=hasAutoEmotion ? 6 : 5;
prompt +=`${affectionNum}. 好感度: 会話内容に応じて、発言の最後に [AFFECTION:数値] を出力してください（0-100）\n`;
prompt +=`   好感度変動の目安: ポジティブな会話+1〜+5、ネガティブな会話-1〜-5\n`;
}
if(hasAutoEmotion||hasAutoAffection) {
prompt +=`\n**注意**: 過去の会話履歴に感情・好感度タグが含まれていない場合がありますが、これは機能が無効だった期間のメッセージです。`;
prompt +=`これからの発言では、上記の指示に従って必ずタグを出力してください。\n`;
}
if(conversation.narrOn) {
const narrationNum=hasAutoEmotion&&hasAutoAffection ? 7 : hasAutoEmotion||hasAutoAffection ? 6 : 5;
if(conversation.autoGenerateNarration) {
 prompt +=`${narrationNum}. **地の文を自動生成**: 会話の合間に [NARRATION] タグで地の文を積極的に挿入してください\n`;
 prompt +=`  -情景描写: 周囲の環境、天気、雰囲気など\n`;
 prompt +=`  -行動描写: キャラクターの動作、表情、仕草など\n`;
 prompt +=`  -心理描写: キャラクターの内面、思考など\n`;
 prompt +=`  -複数のキャラクター発言の合間に自然に挿入してください\n`;
 prompt +=`\n**注意**: 過去の会話履歴に地の文が含まれていない場合がありますが、これは機能が無効だった期間のメッセージです。`;
 prompt +=`これからは積極的に地の文を生成してください。\n`;
} else {
 prompt +=`${narrationNum}. ユーザーが [NARRATION] タグで地の文(情景描写、行動描写)を追加する場合があります\n`;
}
}
prompt +=`\n## 出力形式の例\n\n`;
prompt +=`**単一キャラクターの発言:**\n`;
prompt +=`[CHARACTER:${participants[0]?.name||'アリス'}]\n`;
prompt +=`${participants[0]?.definition.firstPerson||'私'}も同じ意見だよ!`;
if(hasAutoEmotion) {
prompt +=`\n[EMOTION:joy]`;
}
if(hasAutoAffection) {
prompt +=`\n[AFFECTION:55]`;
}
prompt +=`\n\n`;
if(participants.length > 1) {
prompt +=`**複数キャラクターの発言:**\n`;
prompt +=`[CHARACTER:${participants[0]?.name||'アリス'}]\n`;
prompt +=`そうだね、行こうか！`;
if(hasAutoEmotion) {
 prompt +=`\n[EMOTION:joy]`;
}
if(hasAutoAffection) {
 prompt +=`\n[AFFECTION:52]`;
}
prompt +=`\n\n`;
prompt +=`[CHARACTER:${participants[1]?.name||'ボブ'}]\n`;
prompt +=`いいアイデアだね！`;
if(hasAutoEmotion) {
 prompt +=`\n[EMOTION:fun]`;
}
if(hasAutoAffection) {
 prompt +=`\n[AFFECTION:53]`;
}
prompt +=`\n\n`;
}
if(conversation.narrOn) {
prompt +=`**地の文を含む場合:**\n`;
prompt +=`[NARRATION]\n`;
prompt +=`二人は笑顔で頷き合った。窓の外では、春の陽気な光が差し込んでいる。\n\n`;
prompt +=`[CHARACTER:${participants[0]?.name||'アリス'}]\n`;
prompt +=`じゃあ、準備しようか！`;
if(hasAutoEmotion) {
 prompt +=`\n[EMOTION:joy]`;
}
if(hasAutoAffection) {
 prompt +=`\n[AFFECTION:54]`;
}
prompt +=`\n\n`;
}
prompt +=`\n**重要: 必ず各発言の前にタグを付け、タグと内容は改行で分けてください。**\n`;
if(messages.length > 0) {
const lastMessage=messages[messages.length-1];
if(lastMessage.type==='narration') {
 prompt +=`\n**注意**: 直前のメッセージが地の文です。連続して地の文を生成せず、キャラクターの発言から始めてください。\n`;
}
}
return prompt;
}, [getCharById, getEffectiveCharacter]);
const createNewConversation=useCallback(()=> {
const newConv=getDefaultConversation();
sConvs(prev=> [...prev, newConv]);
sCurConvId(newConv.id);
return newConv.id;
}, []);
const forkConv=useCallback((conversationId, msgIdx)=> {
const originalConv=conversations.find(c=> c.id===conversationId);
if(!originalConv) return;
const originalMessages=originalConv.messages||[];
if(msgIdx < 0||msgIdx >=originalMessages.length) {
console.error(`Invalid msgIdx: ${msgIdx}, messages length: ${originalMessages.length}`);
return;
}
const forkedMessages=originalMessages.slice(0, msgIdx+1).map(msg=> ({...msg}));
const forkedConv={
...getDefaultConversation(),
title: `${originalConv.title}（分岐${msgIdx+1}）`,
partIds: [...originalConv.partIds],
backgroundInfo: originalConv.backgroundInfo,
narrOn: originalConv.narrOn,
autoGenerateNarration: originalConv.autoGenerateNarration,
relationships: originalConv.relationships ? [...originalConv.relationships] : [],
parentConversationId: conversationId,
forkPoint: msgIdx,
messages: forkedMessages
};
sConvs(prev=> [...prev, forkedConv]);
sCurConvId(forkedConv.id);
return forkedConv.id;
}, [conversations, getDefaultConversation]);
const delConv=useCallback((conversationId)=> {
const conv=conversations.find(c=> c.id===conversationId);
if(!conv) return;
sConfirmDlg({
title: '確認',
message: `「${conv.title}」を削除しますか?この操作は取り消せません。`,
confirm: ()=> {
 sConvs(prev=> prev.filter(c=> c.id !==conversationId));
 if(curConvId===conversationId) {
 const remaining=conversations.filter(c=> c.id !==conversationId);
 if(remaining.length > 0) {
  sCurConvId(remaining[0].id);
 } else {
  createNewConversation();
 }
 }
 sConfirmDlg(null);
},
cancel: ()=> sConfirmDlg(null)
});
}, [conversations, curConvId, createNewConversation]);
const createCharacterGroup=(name, characterIds)=> {
const newGroup={
id: genId(),
name,
characterIds,
cre: getTs()
};
sCharGrps(prev=> [...prev, newGroup]);
return newGroup.id;
};
const updateCharacterGroup=(groupId, updates)=> {
sCharGrps(prev=>
prev.map(group=> group.id===groupId ? { ...group, ...updates } : group)
);
};
const deleteCharacterGroup=(groupId)=> {
sCharGrps(prev=> prev.filter(g=> g.id !==groupId));
};
const applyCharacterGroup=(groupId)=> {
const group=charGrps.find(g=> g.id===groupId);
if(!group||!curConvId) return;
const currentConv=getCurConv;
if(!currentConv) return;
const newParticipantIds=[...new Set([...currentConv.partIds, ...group.characterIds])];
updConv(curConvId, {
partIds: newParticipantIds
});
};
const getConversationStats=()=> {
const currentConv=getCurConv;
if(!currentConv) return null;
const stats={
totalMessages: currentConv.messages.length,
userMsgs: 0,
charMsgs: {},
narrationCount: 0,
characterAffection: {},
characterAffectionHistory: {}
};
const affectionTracker={};
currentConv.messages.forEach((msg, index)=> {
if(msg.type==='user') {
 stats.userMsgs++;
} else if(msg.type==='narration') {
 stats.narrationCount++;
} else if(msg.type==='character'&&msg.characterId) {
 stats.charMsgs[msg.characterId]=(stats.charMsgs[msg.characterId]||0)+1;
 if(!affectionTracker[msg.characterId]) {
 affectionTracker[msg.characterId]=50;
 stats.characterAffectionHistory[msg.characterId]=[];
 stats.characterAffectionHistory[msg.characterId].push({
  msgIdx: index,
  affection: 50
 });
 }
 if(msg.affection !==undefined) {
 affectionTracker[msg.characterId]=msg.affection;
 }
 stats.characterAffectionHistory[msg.characterId].push({
 msgIdx: index,
 affection: affectionTracker[msg.characterId]
 });
}
});
Object.keys(stats.charMsgs).forEach(charId=> {
const char=getCharById(charId);
if(char&&char.features.affOn) {
 stats.characterAffection[charId]=char.features.affLvl;
}
});
return stats;
};
const expConv=(conversationId)=> {
const conv=conversations.find(c=> c.id===conversationId);
if(!conv) return;
const partsChars=conv.partIds.map(id=> getCharById(id)).filter(Boolean);
const exportData={
conversation: conv,
characters: partsChars,
exportDate: getTs(),
version: '1.0'
};
const blob=new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
const url=URL.createObjectURL(blob);
const a=document.createElement('a');
a.href=url;
a.download=genFile('multi_conversation', conv.title);
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
};
const importConversation=(event)=> {
const file=event.target.files[0];
if(!file) return;
const reader=new FileReader();
reader.onload=(e)=> {
try {
 const data=JSON.parse(e.target.result);
 if(data.conversation&&data.characters) {
 const charIdMap={};
 data.characters.forEach(char=> {
  const existingChar=characters.find(c=> c.name===char.name);
  if(existingChar) {
  charIdMap[char.id]=existingChar.id;
  } else {
  const newId=genId();
  charIdMap[char.id]=newId;
  const importedChar={
   ...char,
   id: newId,
   name: `${char.name}（インポート）`,
   ...mkTs()
  };
  sChars(prev=> [...prev, importedChar]);
  }
 });
 const newConv={
  ...data.conversation,
  id: genId(),
  title: `${data.conversation.title}（インポート）`,
  partIds: data.conversation.partIds.map(id=> charIdMap[id] ?? id),
  messages: data.conversation.messages.map(msg=> ({
  ...msg,
  characterId: msg.characterId ? (charIdMap[msg.characterId] ?? msg.characterId) : null,
  ts: getTs()
  })),
  ...mkTs()
 };
 sConvs(prev=> [...prev, newConv]);
 sCurConvId(newConv.id);
 sErr('');
 } else {
 throw new Error('無効なファイル形式です');
 }
} catch (err) {
 sErr('会話ファイルの読み込みに失敗しました: '+err.message);
}
};
reader.readAsText(file);
event.target.value='';
};
const expChar=(charId)=> {
const char=characters.find(c=> c.id===charId);
if(!char) return;
const exportData=JSON.stringify(char, null, 2);
const blob=new Blob([exportData], { type: 'application/json' });
const url=URL.createObjectURL(blob);
const a=document.createElement('a');
a.href=url;
a.download=genFile('character', char.name);
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
};
const impChar=(event)=> {
const file=event.target.files[0];
if(!file) return;
const reader=new FileReader();
reader.onload=(e)=> {
try {
 const char=JSON.parse(e.target.result);
 const newChar={
 ...char,
 id: genId(),
 name: `${char.name}（インポート）`,
 ...mkTs()
 };
 sChars(prev=> [...prev, newChar]);
 sErr('');
} catch (err) {
 sErr('キャラクターファイルの読み込みに失敗しました: '+err.message);
}
};
reader.readAsText(file);
event.target.value='';
};
const duplicateCharacter=useCallback((charId)=> {
const char=characters.find(c=> c.id===charId);
if(!char) return;
const newChar={
...JSON.parse(JSON.stringify(char)),
id: genId(),
name: `${char.name}（コピー）`,
...mkTs()
};
sChars(prev=> [...prev, newChar]);
}, [characters]);
const generateConversationTitle=(messages)=> {
if(messages.length===0) return '新しい会話';
const firstMsg=messages.find(m=> m.type==='user'||m.type==='character');
if(!firstMsg) return '新しい会話';
const preview=firstMsg.content.slice(0, 30);
return preview+(firstMsg.content.length > 30 ? '…' : '');
};
const generateResponse=async (messages, usePrefill=false, customPrefill=null, forcedNextSpeaker=null)=> {
sLoading(true);
sErr('');
try {
const conversation=getCurConv;
if(!conversation) {
 throw new Error('会話が選択されていません');
}
if(conversation.partIds.length===0) {
 throw new Error('キャラクターが登録されていません');
}
const sysPrompt=buildSystemPrompt(conversation, forcedNextSpeaker, messages);
const participants=conversation.partIds
 .map(id=> getCharById(id))
 .map(c=> getEffectiveCharacter(c))
 .filter(c=> c);
const hasAutoEmotion=participants.some(c=> c.features.emoOn&&c.features.autoEmo);
const hasAutoAffection=participants.some(c=> c.features.affOn&&c.features.autoAff);
const sanitizedMessages=messages
 .filter(msg=> {
 if(!conversation.narrOn&&msg.type==='narration') {
  return false;
 }
 return true;
 })
 .map(msg=> {
 let content='';
 let msgCont=msg.content;
 if(msg.type==='character'&&msg.role==='assistant') {
  msgCont=msgCont.replace(/\[EMOTION:\w+\]\s*/g, '');
  msgCont=msgCont.replace(/\[AFFECTION:\d+\]\s*/g, '');
  msgCont=msgCont.trim();
  const tagsToAdd=[];
  if(hasAutoEmotion&&msg.emotion) {
  tagsToAdd.push(`[EMOTION:${msg.emotion}]`);
  }
  if(hasAutoAffection&&msg.affection !==null&&msg.affection !==undefined) {
  tagsToAdd.push(`[AFFECTION:${msg.affection}]`);
  }
  if(tagsToAdd.length > 0) {
  msgCont=msgCont+'\n'+tagsToAdd.join('\n');
  }
 } else {
  msgCont=msgCont.replace(/\[EMOTION:\w+\]\s*/g, '');
  msgCont=msgCont.replace(/\[AFFECTION:\d+\]\s*/g, '');
 }
 msgCont=msgCont.trim();
 if(msg.type==='narration') {
  content=`[NARRATION]\n${msgCont}`;
 } else if(msg.type==='user') {
  content=`[USER]\n${msgCont}`;
 } else {
  const char=getCharById(msg.characterId);
  const charName=char?.name||'Unknown';
  content=`[CHARACTER:${charName}]\n${msgCont}`;
 }
 return {
  role: msg.role,
  content: content
 };
 });
const mergedMessages=[];
for(let i=0; i < sanitizedMessages.length; i++) {
 const current=sanitizedMessages[i];
 if(mergedMessages.length > 0 &&
  mergedMessages[mergedMessages.length-1].role===current.role) {
 mergedMessages[mergedMessages.length-1].content +='\n\n'+current.content;
 } else {
 mergedMessages.push({ ...current });
 }
}
const finalMessages=[...mergedMessages];
let prefillToUse=customPrefill !==null ? customPrefill : (usePrefill ? prefillText : '');
prefillToUse=prefillToUse.trim()==='' ? '' : prefillToUse.trimEnd();
if(prefillToUse) {
 finalMessages.push({
 role: 'assistant',
 content: prefillToUse
 });
}
const requestBody={
 model: model,
 max_tokens: 4000,
 messages: finalMessages,
 system: sysPrompt
};
if(thinkEn) {
 requestBody.thinking={
 type: 'enabled',
 budget_tokens: thinkBdg
 };
}
const response=await fetch('https://api.anthropic.com/v1/messages', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify(requestBody)
});
if(!response.ok) {
 const errorText=await response.text();
 if(response.status===429) {
 throw new Error(`レート制限に達しました。しばらく待ってから再試行してください。`);
 }
 throw new Error(`API Error ${response.status}: ${errorText}`);
}
const data=await response.json();
if(data.usage) {
 sStats(prev=> ({
 inTok: prev.inTok+(data.usage.input_tokens ?? 0),
 outTok: prev.outTok+(data.usage.output_tokens ?? 0),
 totTok: prev.totTok+(data.usage.input_tokens ?? 0)+(data.usage.output_tokens ?? 0),
 reqCnt: prev.reqCnt+1
 }));
}
let textContent='';
let thinkCont='';
data.content.forEach(block=> {
 if(block.type==='thinking') {
 thinkCont=block.thinking;
 } else if(block.type==='text') {
 textContent=block.text;
 }
});
const fullContent=prefillToUse
 ? prefillToUse+textContent
 : textContent;
const respGrpId=genId();
const { messages: parsedMessages, characterUpdates }=parseMultiCharacterResponse(fullContent, conversation, thinkCont, respGrpId);
if(Object.keys(characterUpdates).length > 0) {
 Object.entries(characterUpdates).forEach(([charId, updates])=> {
 const char=getCharById(charId);
 if(char) {
  const featureUpdates={ ...char.features };
  if(updates.emotion&&char.features.autoEmo) {
  featureUpdates.curEmo=updates.emotion;
  }
  if(updates.affection !==undefined&&char.features.autoAff) {
  featureUpdates.affLvl=updates.affection;
  }
  updChar(charId, { features: featureUpdates });
 }
 });
}
const updatedMessages=[...messages, ...parsedMessages];
const conv=getCurConv;
if(conv) {
 const newTitle=conv.title==='新しい会話'&&updatedMessages.length >=2
 ? generateConversationTitle(updatedMessages)
 : conv.title;
 updConv(curConvId, {
 messages: updatedMessages,
 title: newTitle
 });
}
sPrompt('');
sPrefill('');
} catch (err) {
sErr(err.message||'エラーが発生しました');
} finally {
sLoading(false);
}
};
const hSend=useCallback(async ()=> {
if(!prompt.trim()) return;
if(!curConvId) {
sErr('会話を選択してください');
return;
}
const newMessage={
id: genId(),
role: 'user',
type: messageType,
content: prompt,
ts: getTs(),
respGrpId: null,
alternatives: null
};
const currentMessages=getCurMsgs;
const newHistory=[...currentMessages, newMessage];
updConv(curConvId, {
messages: newHistory
});
await generateResponse(newHistory, true, null, nextSpeaker);
sNextSpk(null);
}, [prompt, curConvId, messageType, nextSpeaker, getCurMsgs, updConv, generateResponse]);
const hEdit=useCallback((index)=> {
const message=getAllMsgs[index];
sEditIdx(index);
sEditCont(message.content);
sEditEmo(message.emotion||null);
sEditAff(message.affection !==undefined&&message.affection !==null ? message.affection : null);
}, [getAllMsgs]);
const hSave=useCallback((index)=> {
const currentMessages=getAllMsgs;
const upd=[...currentMessages];
upd[index].content=editCont;
upd[index].emotion=editEmo;
upd[index].affection=editAff;
updConv(curConvId, {
messages: upd
});
sEditIdx(null);
sEditEmo(null);
sEditAff(null);
}, [getAllMsgs, editCont, editEmo, editAff, curConvId, updConv]);
const hCancel=useCallback(()=> {
sEditIdx(null);
sEditEmo(null);
sEditAff(null);
}, []);
const hDel=useCallback((index)=> {
const currentMessages=getAllMsgs;
const upd=currentMessages.filter((_, i)=> i !==index);
updConv(curConvId, {
messages: upd
});
}, [getAllMsgs, curConvId, updConv]);
const hFork=useCallback((index)=> {
if(!curConvId) return;
forkConv(curConvId, index);
}, [curConvId, forkConv]);
const hRegenGrp=useCallback(async (index)=> {
const currentMessages=getAllMsgs;
const targetMessage=currentMessages[index];
if(!targetMessage) {
sErr('メッセージが見つかりません。');
return;
}
if(targetMessage.role !=='assistant') {
sErr(`アシスタントメッセージのみ再生成できます。（現在のロール: ${targetMessage.role||'なし'}、タイプ: ${targetMessage.type||'なし'}）`);
return;
}
let userMessageIndex=index-1;
while(userMessageIndex >=0&&currentMessages[userMessageIndex].role==='assistant') {
userMessageIndex--;
}
if(userMessageIndex < 0||currentMessages[userMessageIndex].role !=='user') {
sErr('再生成できるユーザーメッセージが見つかりません。');
return;
}
const historyUpToPoint=currentMessages.slice(0, userMessageIndex+1);
const sameGroupMessages=[];
if(targetMessage.respGrpId) {
for(let i=userMessageIndex+1; i < index; i++) {
 if(currentMessages[i].respGrpId===targetMessage.respGrpId) {
 sameGroupMessages.push(currentMessages[i]);
 }
}
}
let prefillParts=[];
for(const msg of sameGroupMessages) {
if(msg.type==='narration') {
 prefillParts.push(`[NARRATION]\n${msg.content}`);
} else if(msg.type==='character') {
 const char=getCharById(msg.characterId);
 prefillParts.push(`[CHARACTER:${char?.name}]\n${msg.content}`);
}
}
if(targetMessage.type==='narration') {
prefillParts.push('[NARRATION]\n');
} else if(targetMessage.type==='character') {
const char=getCharById(targetMessage.characterId);
prefillParts.push(`[CHARACTER:${char?.name}]\n`);
}
if(regenPre) {
prefillParts[prefillParts.length-1] +=regenPre;
}
const joinedPrefill=prefillParts.join('\n\n');
const prefill=joinedPrefill.trim()==='' ? '' : joinedPrefill.trimEnd();
const updatedMessages=currentMessages.filter((msg, i)=> {
if(i < index) return true;
if(msg.respGrpId&&msg.respGrpId===targetMessage.respGrpId) return false;
if(!msg.respGrpId&&i===index) return false;
return true;
});
updConv(curConvId, {
messages: updatedMessages
});
await generateResponse(historyUpToPoint, false, prefill);
sRegenPre('');
sShowRegenPre(null);
}, [getAllMsgs, curConvId, updConv, regenPre, generateResponse, getCharById]);
const handleRegenerateFrom=useCallback(async (index)=> {
const currentMessages=getAllMsgs;
if(index===0) {
sErr('最初のメッセージからは再生成できません。');
return;
}
const historyUpToPoint=currentMessages.slice(0, index);
updConv(curConvId, {
messages: historyUpToPoint
});
if(historyUpToPoint.length > 0&&historyUpToPoint[historyUpToPoint.length-1].role==='user') {
const trimmedPrefill=regenPre.trim()==='' ? '' : regenPre.trimEnd();
await generateResponse(historyUpToPoint, false, trimmedPrefill);
}
sRegenPre('');
sShowRegenPre(null);
}, [getAllMsgs, curConvId, updConv, regenPre, generateResponse]);
const handleSwitchVersion=useCallback((msgIdx, alternativeId)=> {
const currentMessages=getAllMsgs;
const message=currentMessages[msgIdx];
if(!message||!message.alternatives) return;
const selectedAlt=message.alternatives.find(alt=> alt.id===alternativeId);
if(!selectedAlt) return;
const updatedMessage={
...message,
content: selectedAlt.content,
emotion: selectedAlt.emotion,
affection: selectedAlt.affection,
thinking: selectedAlt.thinking,
alternatives: message.alternatives.map(alt=> ({
 ...alt,
 isActive: alt.id===alternativeId
}))
};
const updatedMessages=currentMessages.map((msg, i)=>
i===msgIdx ? updatedMessage : msg
);
updConv(curConvId, {
messages: updatedMessages
});
}, [getAllMsgs, curConvId, updConv]);
const scrollToMessage=useCallback((index)=> {
const totalMessages=getAllMsgs.length;
const currentStartIndex=totalMessages <=visMsgCnt ? 0 : totalMessages-visMsgCnt;
if(index >=currentStartIndex) {
msgRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
return;
}
const newVisibleCount=totalMessages-index;
sVisMsgCnt(newVisibleCount);
setTimeout(()=> {
msgRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}, 100);
}, [getAllMsgs.length, visMsgCnt]);
const fetchModels=async ()=> {
sLoadMdls(true);
try {
const response=await fetch('https://api.anthropic.com/v1/models', {
 method: 'GET',
 headers: {
 'anthropic-version': '2023-06-01',
 },
});
if(!response.ok) {
 throw new Error(`API Error: ${response.status}`);
}
const data=await response.json();
if(data.data&&Array.isArray(data.data)) {
 const sortedModels=data.data.sort((a, b)=> {
 return b.created_at.localeCompare(a.created_at);
 });
 const formattedModels=sortedModels.map(model=> ({
 id: model.id,
 name: getShortName(model.display_name, model.id),
 icon: getIconForModel(model.display_name, model.id)
 }));
 setMdls(formattedModels);
 if(!formattedModels.find(m=> m.id===model)) {
 const defaultModel=formattedModels.find(m=> m.id.includes('sonnet-4-5'))
  ?? formattedModels[0];
 if(defaultModel) {
  setMdl(defaultModel.id);
 }
 }
} else {
 throw new Error('Invalid response format');
}
} catch (err) {
console.error('Failed to fetch models:', err);
setMdls(models);
} finally {
sLoadMdls(false);
}
};
const saveToStorage=useCallback(async ()=> {
if(!autoSave||!inited) return;
sSaveState('saving');
try {
const saveData={
 characters,
 charGrps,
 conversations,
 curConvId,
 model,
 thinkEn,
 thinkBdg,
 stats,
 ts: getTs(),
 version: '1.0'
};
await IDB.setItem(STORE_KEY, saveData);
try {
 localStorage.setItem(STORE_KEY, JSON.stringify(saveData));
} catch (localStorageErr) {
 console.warn('LocalStorage save failed (quota exceeded), using IndexedDB only:', localStorageErr);
}
sSaved(new Date());
sSaveState('saved');
setTimeout(()=> sSaveState(''), 2000);
} catch (err) {
console.error('Save failed:', err);
sSaveState('error');
setTimeout(()=> sSaveState(''), 3000);
}
}, [characters, charGrps, conversations, curConvId, model, thinkEn, thinkBdg, stats, autoSave, inited]);
const debouncedSave=useMemo(
()=> debounce(()=> {
saveToStorage();
}, SAVE_DELAY),
[saveToStorage]
);
const loadFromStorage=async ()=> {
try {
let data=null;
try {
 data=await IDB.getItem(STORE_KEY);
} catch (indexedDBErr) {
 console.warn('IndexedDB load failed, trying LocalStorage:', indexedDBErr);
}
if(!data) {
 const dataString=localStorage.getItem(STORE_KEY);
 if(dataString) {
 data=JSON.parse(dataString);
 if(data) {
  console.log('Migrating data from LocalStorage to IndexedDB...');
  try {
  await IDB.setItem(STORE_KEY, data);
  console.log('Migration complete');
  } catch (migrationErr) {
  console.error('Migration failed:', migrationErr);
  }
 }
 }
}
if(data) {
 if(data.characters&&data.characters.length > 0) {
 const migratedCharacters=data.characters.map(char=> {
  const features=char.features ?? {};
  const definition=char.definition ?? {};
  return {
  ...char,
  baseCharacterId: char.baseCharacterId ?? null,
  overrides: char.overrides ?? {},
  definition: {
   ...definition,
   custPrompt: definition.custPrompt ?? ''
  },
  features: {
   emoOn: features.emoOn ?? true,
   affOn: features.affOn ?? false,
   autoEmo: features.autoEmo ?? true,
   autoAff: features.autoAff ?? true,
   curEmo: features.curEmo ?? 'neutral',
   affLvl: features.affLvl ?? 50,
   avatar: features.avatar ?? '😊',
   avType: features.avType ?? 'emoji',
   avatImg: features.avatImg ?? null
  }
  };
 });
 sChars(migratedCharacters);
 }
 if(data.charGrps&&data.charGrps.length > 0) {
 sCharGrps(data.charGrps);
 }
 if(data.conversations&&data.conversations.length > 0) {
 const migratedConversations=data.conversations.map(conv=> ({
  ...conv,
  narrOn: conv.narrOn ?? true,
  autoGenerateNarration: conv.autoGenerateNarration ?? false,
  backgroundInfo: conv.backgroundInfo ?? '',
  relationships: conv.relationships ?? [],
  parentConversationId: conv.parentConversationId ?? null,
  forkPoint: conv.forkPoint ?? null
 }));
 sConvs(migratedConversations);
 }
 if(data.curConvId) {
 sCurConvId(data.curConvId);
 }
 if(data.model) {
 setMdl(data.model);
 }
 if(data.thinkEn !==undefined) {
 sThinkEn(data.thinkEn);
 }
 if(data.thinkBdg) {
 sThinkBdg(data.thinkBdg);
 }
 if(data.stats) {
 sStats(data.stats);
 }
 if(data.ts) {
 sSaved(new Date(data.ts));
 }
 return true;
}
return false;
} catch (err) {
console.error('Load failed:', err);
return false;
}
};
useEffect(()=> {
const initializeData=async ()=> {
const hasData=await loadFromStorage();
if(!hasData) {
 const defaultChar=getDefaultCharacter();
 sChars([defaultChar]);
 const defaultConv=getDefaultConversation();
 sConvs([defaultConv]);
 sCurConvId(defaultConv.id);
}
sInited(true);
fetchModels();
};
initializeData();
}, []);
useEffect(()=> {
if(!inited) return;
debouncedSave();
}, [characters, conversations, curConvId, model, thinkEn, thinkBdg, stats, autoSave, inited, debouncedSave]);
useEffect(()=> {
msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
sVisMsgCnt(100);
}, [curConvId]);
useEffect(()=> {
if(getAllMsgs.length > 0) {
msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}
}, [getAllMsgs.length]);
useEffect(()=> {
const textarea=txtRef.current;
if(!textarea) return;
textarea.style.height='auto';
const newHeight=Math.min(Math.max(textarea.scrollHeight, 80), 400);
textarea.style.height=`${newHeight}px`;
}, [prompt]);
const formatLastSaved=()=> {
if(!saved) return '';
const now=new Date();
const diff=Math.floor((now-saved)/1000);
if(diff < 60) return `${diff}秒前`;
if(diff < 3600) return `${Math.floor(diff/60)}分前`;
return saved.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
};
const curConv=getCurConv;
const currentMessages=getCurMsgs;
if(!inited) {
return(
<div className="flex items-center justify-center h-screen bg-gradient-to-br from-indigo-50 to-purple-50"><div className="text-center"><div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div><p className="text-gray-600">読み込み中…</p></div></div>
);
}
return(
<div className="flex flex-col h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
{}
<div className="bg-white shadow p-3 flex items-center justify-between"><div className="flex items-center gap-3"><button
  onClick={()=> sShowSide(!showSide)}
  className="p-2 hover:bg-gray-100 rounded transition lg:hidden"
 >
  {showSide ? <X size={20} /> : <Menu size={20} />}
 </button><h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2"><Users size={24} />
  マルチキャラクター会話
 </h1>
 {curConv&&(
  <div className="hidden md:flex items-center gap-2 text-sm text-gray-600"><MessageSquare size={14} /><span className="max-w-xs truncate">{curConv.title}</span><span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
   {curConv.partIds.length}人
  </span></div>
 )}
 <div className="hidden lg:flex items-center gap-2 text-xs">
  {saveState==='saving'&&(
  <span className="flex items-center gap-1 text-blue-600"><Save size={12} className="animate-pulse" />
   保存中
  </span>
  )}
  {saveState==='saved'&&(
  <span className="flex items-center gap-1 text-green-600"><Save size={12} />
   保存完了
  </span>
  )}
  {saveState===''&&saved&&(
  <span className="text-gray-500 flex items-center gap-1"><HardDrive size={12} />
   {formatLastSaved()}
  </span>
  )}
 </div></div><div className="flex items-center gap-2"><button
  onClick={()=> sShowCharMod(true)}
  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition text-sm"
 ><User size={16} /><span className="hidden md:inline">キャラ管理</span></button>
 {curConv&&(
  <button
  onClick={()=> sShowConvSet(!showConvSet)}
  className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 transition text-sm"
  ><Users size={16} /><span className="hidden md:inline">会話設定</span></button>
 )}
 <button
  onClick={()=> sShowSet(!showSet)}
  className="p-2 hover:bg-gray-100 rounded transition"
 ><Settings size={20} /></button></div></div>
{}
{showSet&&(
 <div className="bg-white border-b border-gray-200 p-4 space-y-3 max-h-96 overflow-y-auto"><div className="flex flex-wrap gap-2"><button
  onClick={()=> createNewConversation()}
  className="flex items-center gap-1 px-3 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition text-sm"
  ><Plus size={16} />
  新規会話
  </button><button
  onClick={()=> {
   if(curConv) {
   expConv(curConv.id);
   }
  }}
  disabled={!curConv||currentMessages.length===0}
  className="flex items-center gap-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition disabled:bg-gray-300 text-sm"
  ><Download size={16} />
  会話保存
  </button><button
  onClick={()=> convFileRef.current?.click()}
  className="flex items-center gap-1 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition text-sm"
  ><Upload size={16} />
  会話読込
  </button></div><div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded p-3"><div className="flex items-center justify-between mb-2"><h3 className="text-sm font-semibold text-blue-800 flex items-center gap-2"><HardDrive size={14} />
   自動保存
  </h3><label className="flex items-center gap-2"><input
   type="checkbox"
   checked={autoSave}
   onChange={(e)=> sAutoSave(e.target.checked)}
   className="w-4 h-4"
   /><span className="text-xs text-gray-700">有効</span></label></div><p className="text-xs text-gray-600">
  💾 会話とキャラクターは自動的に保存されます
  </p></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><div><div className="flex items-center justify-between mb-1"><label className="block text-sm font-medium text-gray-700">モデル</label><button
   onClick={fetchModels}
   disabled={loadMdls}
   className="text-indigo-600 hover:text-indigo-700 disabled:text-gray-400 p-1"
   title="モデル一覧を更新"
   ><RefreshCw size={14} className={loadMdls ? 'animate-spin' : ''} /></button></div><select
   value={model}
   onChange={(e)=> setMdl(e.target.value)}
   className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
   disabled={loading||loadMdls}
  >
   {models.length===0 ? (
   <option value="">読込中...</option>
   ) : (
   models.map(model=> (
    <option key={model.id} value={model.id}>{model.icon} {model.name}</option>
   ))
   )}
  </select></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Thinking</label><div className="flex items-center gap-3"><input
   type="checkbox"
   checked={thinkEn}
   onChange={(e)=> sThinkEn(e.target.checked)}
   className="w-5 h-5"
   disabled={loading}
   />
   {thinkEn&&(
   <input
    type="number"
    value={thinkBdg}
    onChange={(e)=> sThinkBdg(Number(e.target.value))}
    className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm"
    min="1000"
    max="10000"
    step="500"
    disabled={loading}
   />
   )}
  </div></div></div><div className="bg-blue-50 border border-blue-200 rounded p-3"><h3 className="text-sm font-semibold text-blue-800 mb-2">📊 使用量</h3><div className="grid grid-cols-2 gap-2 text-xs"><div><span className="text-gray-600">リクエスト:</span><span className="font-semibold text-blue-700">{stats.reqCnt}</span></div><div><span className="text-gray-600">合計トークン:</span><span className="font-semibold text-blue-700">{stats.totTok.toLocaleString()}</span></div><div><span className="text-gray-600">入力:</span><span className="font-semibold text-green-700">{stats.inTok.toLocaleString()}</span></div><div><span className="text-gray-600">出力:</span><span className="font-semibold text-purple-700">{stats.outTok.toLocaleString()}</span></div></div></div></div>
)}
{}
{showConvSet&&curConv&&(
 <ConversationSettingsPanel
 conversation={curConv}
 characters={characters}
 onUpdate={(updates)=> updConv(curConv.id, updates)}
 onClose={()=> sShowConvSet(false)}
 />
)}
<div className="flex flex-1 overflow-hidden">
 {}
 <div className={`w-64 bg-white border-r border-gray-200 overflow-y-auto p-3 flex-shrink-0 transition ${showSide ? 'block' : 'hidden lg:block'}`}><div className="flex gap-1 mb-3"><button
  onClick={()=> sSideView('conversations')}
  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition ${
   sideView==='conversations'
   ? 'bg-indigo-600 text-white'
   : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
  }`}
  ><MessageSquare size={12} className="inline mr-1" />
  会話
  </button><button
  onClick={()=> sSideView('messages')}
  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition ${
   sideView==='messages'
   ? 'bg-indigo-600 text-white'
   : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
  }`}
  disabled={!curConv}
  ><Hash size={12} className="inline mr-1" />
  履歴
  </button><button
  onClick={()=> sSideView('stats')}
  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition ${
   sideView==='stats'
   ? 'bg-indigo-600 text-white'
   : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
  }`}
  disabled={!curConv}
  ><BookOpen size={12} className="inline mr-1" />
  統計
  </button></div>
 {sideView==='conversations' ? (
  <><h3 className="font-semibold text-gray-700 mb-2 flex items-center justify-between"><span className="flex items-center gap-2"><MessageSquare size={16} />
   会話一覧
  </span><button
   onClick={()=> createNewConversation()}
   className="p-1 hover:bg-indigo-100 rounded"
   title="新規会話"
  ><Plus size={16} className="text-indigo-600" /></button></h3>
  {conversations.length > 0 ? (
  <div className="space-y-1">
   {sortedConversations.map((conv)=> {
    const isActive=curConvId===conv.id;
    return(
    <ConversationListItem
     key={conv.id}
     conversation={conv}
     isActive={isActive}
     onSelect={sCurConvId}
     onEditTitle={(id, title)=> {
     sEditConvTitle(id);
     sEditTitle(title);
     }}
     onExport={expConv}
     onDelete={delConv}
     editConvTitle={editConvTitle}
     editTitle={editTitle}
     sEditTitle={sEditTitle}
     sEditConvTitle={sEditConvTitle}
     updConv={updConv}
    />
    );
   })}
  </div>
  ) : (
  <p className="text-sm text-gray-500">会話がありません</p>
  )}
 </>
 ) : sideView==='messages' ? (
  <><h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2"><Hash size={16} />
  メッセージ履歴
  </h3>
  {currentMessages.length===0 ? (
  <p className="text-sm text-gray-500">メッセージがありません</p>
  ) : (
  <div className="space-y-1">
   {currentMessages.map((msg, idx)=> {
   const char=msg.characterId ? getCharById(msg.characterId) : null;
   return(
    <button
    key={idx}
    onClick={()=> scrollToMessage(idx)}
    className={`w-full text-left px-2 py-2 rounded text-xs transition ${
     msg.type==='user'
     ? 'bg-blue-50 hover:bg-blue-100 text-blue-800'
     : msg.type==='narration'
      ? 'bg-amber-50 hover:bg-amber-100 text-amber-800'
      : 'bg-purple-50 hover:bg-purple-100 text-purple-800'
    }`}
    ><div className="font-semibold flex items-center gap-1 mb-1">
     {msg.type==='user' ? (
     <><User size={12} /> #{idx+1} あなた</>
     ) : msg.type==='narration' ? (
     <><FileText size={12} /> #{idx+1} 地の文</>
     ) : (
     <>
      {char&&<AvatarDisplay character={char} size="sm" />}
      #{idx+1} {char?.name||'不明'}
     </>
     )}
    </div><div className="truncate opacity-75">{msg.content.slice(0, 30)}...</div></button>
   );
   })}
  </div>
  )}
  </>
 ) : sideView==='stats' ? (
  <><h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2"><BookOpen size={16} />
  統計情報
  </h3>
  {(()=> {
  const stats=getConversationStats();
  if(!stats) return <p className="text-sm text-gray-500">統計情報がありません</p>;
  return(
   <div className="space-y-3"><div className="bg-blue-50 border border-blue-200 rounded p-3"><h4 className="font-semibold text-sm text-blue-800 mb-2">メッセージ</h4><div className="text-xs space-y-1"><div className="flex justify-between"><span>総メッセージ数:</span><span className="font-semibold">{stats.totalMessages}</span></div><div className="flex justify-between"><span>あなた:</span><span className="font-semibold text-blue-600">{stats.userMsgs}</span></div><div className="flex justify-between"><span>地の文:</span><span className="font-semibold text-amber-600">{stats.narrationCount}</span></div></div></div><div className="bg-purple-50 border border-purple-200 rounded p-3"><h4 className="font-semibold text-sm text-purple-800 mb-2">キャラクター発言数</h4><div className="text-xs space-y-1">
    {Object.entries(stats.charMsgs).map(([charId, count])=> {
     const char=getCharById(charId);
     return(
     <div key={charId} className="flex justify-between items-center"><div className="flex items-center gap-1">
      {char&&<AvatarDisplay character={char} size="sm" />}
      <span>{char?.name||'不明'}</span></div><span className="font-semibold text-purple-600">{count}</span></div>
     );
    })}
    </div></div>
   {Object.keys(stats.characterAffection).length > 0&&(
    <div className="bg-red-50 border border-red-200 rounded p-3"><h4 className="font-semibold text-sm text-red-800 mb-2">現在の好感度</h4><div className="text-xs space-y-1">
     {Object.entries(stats.characterAffection).map(([charId, affLvl])=> {
     const char=getCharById(charId);
     return(
      <div key={charId} className="flex justify-between items-center"><div className="flex items-center gap-1">
      {char&&<AvatarDisplay character={char} size="sm" />}
      <span>{char?.name||'不明'}</span></div><span className="font-semibold text-red-600 flex items-center gap-1"><Heart size={10} />
      {affLvl}
      </span></div>
     );
     })}
    </div></div>
   )}
   {Object.keys(stats.characterAffectionHistory||{}).length > 0&&(
    <div className="bg-pink-50 border border-pink-200 rounded p-3"><h4 className="font-semibold text-sm text-pink-800 mb-2">好感度推移</h4><div className="space-y-3">
     {Object.entries(stats.characterAffectionHistory).map(([charId, history])=> {
     const char=getCharById(charId);
     if(!history||history.length===0) return null;
     const maxPoints=20;
     const sampledHistory=history.length <=maxPoints
      ? history
      : history.filter((_, i)=> i % Math.ceil(history.length/maxPoints)===0||i===history.length-1);
     if(sampledHistory.length===0) return null;
     const width=180;
     const height=30;
     const padding=2;
     const points=sampledHistory.map((point, index)=> {
      const x=sampledHistory.length===1
      ? width/2
      : padding+(index/(sampledHistory.length-1))*(width-padding*2);
      const y=height-padding-((point.affection/100)*(height-padding*2));
      return `${x},${y}`;
     });
     const pathData=sampledHistory.length===1
      ? `M ${points[0]}`
      : `M ${points.join(' L ')}`;
     return(
      <div key={charId} className="space-y-1"><div className="flex items-center gap-1 text-xs">
      {char&&<AvatarDisplay character={char} size="sm" />}
      <span className="font-medium">{char?.name||'不明'}</span></div><svg width={width} height={height} className="bg-white rounded border border-pink-200">
      {}
      <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="#fce7f3" strokeWidth="1" strokeDasharray="2,2" />
      {}
      {sampledHistory.length > 1&&(
      <path
      d={pathData}
      fill="none"
      stroke="#ec4899"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      />
      )}
      {}
      {sampledHistory.map((point, index)=> {
      const x=sampledHistory.length===1
      ? width/2
      : padding+(index/(sampledHistory.length-1))*(width-padding*2);
      const y=height-padding-((point.affection/100)*(height-padding*2));
      return(
      <circle
      key={index}
      cx={x}
      cy={y}
      r="2"
      fill="#ec4899"
      />
      );
      })}
      </svg><div className="flex justify-between text-xs text-gray-500"><span>開始</span><span className="text-pink-600 font-medium">
      {sampledHistory[0]?.affection} → {sampledHistory[sampledHistory.length-1]?.affection}
      </span></div></div>
     );
     })}
    </div></div>
   )}
   </div>
  );
  })()}
  </>
 ) : null}
 </div>
 {}
 <div className="flex-1 overflow-y-auto p-4 space-y-4">
 {currentMessages.length===0&&curConv&&(
  <div className="text-center text-gray-500 mt-20"><div className="text-6xl mb-4">💬</div><p className="text-lg font-semibold">会話を開始しましょう!</p>
  {curConv.partIds.length===0 ? (
   <><p className="text-sm mt-2 text-orange-600">⚠️ キャラクターを追加してください</p><button
    onClick={()=> sShowConvSet(true)}
    className="mt-4 px-6 py-3 bg-purple-600 text-white rounded hover:bg-purple-700"
   >
    会話設定を開く
   </button></>
  ) : (
   <p className="text-sm mt-2 text-gray-400">会話は自動的に保存されます</p>
  )}
  </div>
 )}
 {}
 {getAllMsgs.length > visMsgCnt&&(
  <div className="text-center py-2"><button
   onClick={()=> sVisMsgCnt(prev=> prev+MSG_INC)}
   className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition text-sm font-medium flex items-center gap-2 mx-auto"
  ><ChevronDown size={16} />
   過去のメッセージを読み込む ({getAllMsgs.length-visMsgCnt}件)
  </button></div>
 )}
 {getVisibleMessages.map((message, visibleIndex)=> {
  const startIndex=getAllMsgs.length <=visMsgCnt ? 0 : getAllMsgs.length-visMsgCnt;
  const actualIndex=startIndex+visibleIndex;
  return(
  <div key={actualIndex} ref={(el)=> msgRefs.current[actualIndex]=el}><MessageBubble
  message={message}
  index={actualIndex}
  character={message.characterId ? getCharById(message.characterId) : null}
  editIdx={editIdx}
  editCont={editCont}
  sEditCont={sEditCont}
  editEmo={editEmo}
  sEditEmo={sEditEmo}
  editAff={editAff}
  sEditAff={sEditAff}
  hEdit={hEdit}
  hSave={hSave}
  hCancel={hCancel}
  hDel={hDel}
  hFork={hFork}
  showRegenPre={showRegenPre}
  sShowRegenPre={sShowRegenPre}
  regenPre={regenPre}
  sRegenPre={sRegenPre}
  hRegenGrp={hRegenGrp}
  handleRegenerateFrom={handleRegenerateFrom}
  handleSwitchVersion={handleSwitchVersion}
  showVers={showVers}
  sShowVer={sShowVer}
  loading={loading}
  showThinking={showThinking}
  sShowThink={sShowThink}
  emotions={emotions}
  /></div>
  );
 })}
 {loading&&(
  <div className="flex justify-start"><div className="bg-white rounded-2xl rounded-tl-none shadow p-4"><div className="flex items-center gap-3"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div><span className="text-gray-600 text-sm">考え中...</span></div></div></div>
 )}
 {error&&(
  <div className="bg-red-50 border border-red-200 rounded p-4 flex items-start gap-3"><AlertCircle className="flex-shrink-0 text-red-500" size={20} /><div className="flex-1"><p className="font-semibold text-red-800 text-sm">エラー</p><p className="text-sm text-red-600">{error}</p></div></div>
 )}
 <div ref={msgEndRef} /></div></div>
{}
<div className="bg-white border-t border-gray-200 p-3 space-y-2"><div className="flex gap-2 items-center flex-wrap"><div className="flex gap-1 bg-gray-100 rounded p-1"><button
  onClick={()=> sMsgType('user')}
  className={`px-3 py-1.5 rounded text-sm font-medium transition ${
   messageType==='user'
   ? 'bg-white text-indigo-600 shadow'
   : 'text-gray-600 hover:text-gray-800'
  }`}
  ><User size={14} className="inline mr-1" />
  発言
  </button><button
  onClick={()=> sMsgType('narration')}
  className={`px-3 py-1.5 rounded text-sm font-medium transition ${
   messageType==='narration'
   ? 'bg-white text-purple-600 shadow'
   : 'text-gray-600 hover:text-gray-800'
  }`}
  disabled={!curConv?.narrOn}
  ><FileText size={14} className="inline mr-1" />
  地の文
  </button></div>
 {curConv&&curConv.partIds.length > 0&&(
  <div className="flex items-center gap-2"><label className="text-xs text-gray-600">次の発言者:</label><select
   value={nextSpeaker||''}
   onChange={(e)=> sNextSpk(e.target.value||null)}
   className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
  ><option value="">自動</option>
   {curConv.partIds.map(charId=> {
   const char=getCharById(charId);
   if(!char) return null;
   const avatar=char.features.avType==='emoji' ? char.features.avatar : '📷';
   return(
    <option key={charId} value={charId}>
    {avatar} {char.name}
    </option>
   );
   })}
  </select></div>
 )}
 <input
  type="text"
  value={prefillText}
  onChange={(e)=> sPrefill(e.target.value)}
  placeholder="Prefill（オプション）"
  className="flex-1 min-w-[150px] px-3 py-2 border border-gray-300 rounded text-sm"
  disabled={loading}
 /></div><div className="flex gap-2"><textarea
  ref={txtRef}
  value={prompt}
  onChange={(e)=> sPrompt(e.target.value)}
  onKeyDown={(e)=> {
  if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)) {
   hSend();
  }
  }}
  placeholder={
  !curConv
   ? '会話を選択してください'
   : curConv.partIds.length===0
   ? 'キャラクターを追加してください'
   : messageType==='narration'
    ? '地の文を入力... (情景描写、行動描写など)'
    : 'メッセージを入力... (Ctrl+Enter で送信)'
  }
  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm resize-none overflow-y-auto"
  style={{ minHeight: '80px', maxHeight: '400px' }}
  disabled={loading||!curConv||curConv.partIds.length===0}
 /><button
  onClick={hSend}
  disabled={loading||!prompt.trim()||!curConv||curConv.partIds.length===0}
  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition disabled:bg-gray-300 flex items-center gap-2 text-sm self-end"
 ><Send size={16} /></button></div></div>
{}
{showCharMod&&(
 <CharacterModal
 characters={characters}
 sChars={sChars}
 charGrps={charGrps}
 sCharGrps={sCharGrps}
 getDefaultCharacter={getDefaultCharacter}
 expChar={expChar}
 impChar={impChar}
 charFileRef={charFileRef}
 emotions={emotions}
 onClose={()=> sShowCharMod(false)}
 />
)}
{}
{confirmDlg&&(
 <ConfirmDialog
 title={confirmDlg.title}
 message={confirmDlg.message}
 onConfirm={confirmDlg.confirm}
 onCancel={confirmDlg.cancel}
 />
)}
{}
<input
 ref={charFileRef}
 type="file"
 accept=".json"
 onChange={impChar}
 className="hidden"
/><input
 ref={convFileRef}
 type="file"
 accept=".json"
 onChange={importConversation}
 className="hidden"
/></div>
);
};
const AvatarDisplay=React.memo(({ character, size='md' })=> {
if(!character) return null;
const sizeClasses={
sm: 'w-6 h-6 text-sm',
md: 'w-10 h-10 text-2xl',
lg: 'w-16 h-16 text-4xl'
};
const sizeClass=sizeClasses[size]||sizeClasses.md;
if(character.features.avType==='image'&&character.features.avatImg) {
return(
<div className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0 bg-gray-100`}><img
 src={character.features.avatImg}
 alt={character.name}
 className="w-full h-full object-cover"
 /></div>
);
}
return(
<span className={`${sizeClass} flex items-center justify-center flex-shrink-0`}>
{character.features.avatar||'😊'}
</span>
);
}, (prevProps, nextProps)=> {
return prevProps.character?.id===nextProps.character?.id &&
 prevProps.character?.features.avatar===nextProps.character?.features.avatar &&
 prevProps.character?.features.avatImg===nextProps.character?.features.avatImg &&
 prevProps.size===nextProps.size;
});
const ConfirmDialog=React.memo(({ title, message, confirm, cancel })=> {
return(
<div
className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
onClick={(e)=> {
 if(e.target===e.currentTarget) {
 cancel();
 }
}}
><div className="bg-white rounded shadow-xl max-w-md w-full mx-4"><div className="p-6"><h3 className="text-lg font-bold text-gray-800 mb-4">{title}</h3><p className="text-gray-600 whitespace-pre-line mb-6">{message}</p><div className="flex gap-3 justify-end"><button
  onClick={cancel}
  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
  >
  キャンセル
  </button><button
  onClick={confirm}
  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
  >
  OK
  </button></div></div></div></div>
);
});
const EmojiPicker=({ select, close })=> {
const [activeCategory, setActiveCategory]=useState('smileys');
const emojiCategories={
smileys: {
name: '😊 顔',
emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '😶‍🌫️', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐']
},
animals: {
name: '🐶 動物',
emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔']
},
food: {
name: '🍕 食べ物',
emojis: ['🍎', '🍏', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯']
},
activities: {
name: '⚽ 活動',
emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '🤺', '🤾', '🏌️', '🏇', '🧘', '🏊', '🚣', '🧗', '🚵', '🚴', '🏎️', '🏍️', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩']
},
travel: {
name: '✈️ 旅行',
emojis: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵', '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '⛽', '🚧', '🚦', '🚥', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛️', '⛪', '🕌', '🛕', '🕍', '⛩️', '🕋']
},
objects: {
name: '📱 物',
emojis: ['⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '🪪', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🪠', '🧺', '🧻', '🚽', '🚰', '🚿', '🛁', '🛀', '🧼', '🪥', '🪒', '🧽', '🪣', '🧴', '🛎️', '🔑', '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🛌', '🧸', '🪆', '🖼️', '🪞', '🪟', '🛍️', '🎁', '🎈', '🎏', '🎀', '🪄', '🪅', '🎊', '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧', '💌', '📥', '📤', '📦', '🏷️', '🪧', '📪', '📫', '📬', '📭', '📮', '📯', '📜', '📃', '📄', '📑', '🧾', '📊', '📈', '📉', '🗒️', '🗓️', '📆', '📅', '🗑️', '📇', '🗃️', '🗳️', '🗄️', '📋', '📁', '📂', '🗂️', '🗞️', '📰', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '📖', '🔖', '🧷', '🔗', '📎', '🖇️', '📐', '📏', '🧮', '📌', '📍', '✂️', '🖊️', '🖋️', '✒️', '🖌️', '🖍️', '📝', '✏️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓']
},
symbols: {
name: '❤️ 記号',
emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🛗', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '⚧️', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣', '⏏️', '▶️', '⏸️', '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️', '🟰', '♾️', '💲', '💱', '™️', '©️', '®️', '〰️', '➰', '➿', '🔚', '🔙', '🔛', '🔝', '🔜', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '👁️‍🗨️', '💬', '💭', '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦', '🕧']
}
};
return(
<div
className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
onClick={(e)=> {
 if(e.target===e.currentTarget) {
 close();
 }
}}
><div
 className="bg-white rounded shadow-xl w-full max-w-lg"
 onClick={(e)=> e.stopPropagation()}
><div className="flex items-center justify-between p-4 border-b"><h3 className="text-lg font-bold text-gray-800">絵文字を選択</h3><button
  onClick={(e)=> {
  e.preventDefault();
  e.stopPropagation();
  close();
  }}
  className="p-2 hover:bg-gray-100 rounded"
 ><X size={20} /></button></div><div className="flex border-b overflow-x-auto">
 {Object.entries(emojiCategories).map(([key, category])=> (
  <button
  key={key}
  onClick={(e)=> {
   e.preventDefault();
   e.stopPropagation();
   setActiveCategory(key);
  }}
  className={`px-4 py-2 text-sm whitespace-nowrap ${
   activeCategory===key
   ? 'border-b-2 border-purple-600 text-purple-600 font-medium'
   : 'text-gray-600 hover:bg-gray-50'
  }`}
  >
  {category.name}
  </button>
 ))}
 </div><div className="p-4 h-80 overflow-y-auto" onClick={(e)=> e.stopPropagation()}><div className="grid grid-cols-8 gap-2">
  {emojiCategories[activeCategory].emojis.map((emoji, index)=> (
  <button
   key={index}
   onClick={(e)=> {
   e.preventDefault();
   e.stopPropagation();
   select(emoji);
   close();
   }}
   className="text-3xl p-2 hover:bg-gray-100 rounded transition"
  >
   {emoji}
  </button>
  ))}
 </div></div></div></div>
);
};
const ImageCropper=({ imageSrc, crop, cancel })=> {
const canvasRef=useRef(null);
const [crop, setCrop]=useState({ x: 0, y: 0 });
const [zoom, setZoom]=useState(1.0);
const [isDragging, setIsDragging]=useState(false);
const [dragStart, setDragStart]=useState({ x: 0, y: 0 });
const [imageSize, setImageSize]=useState({ width: 0, height: 0 });
const imageRef=useRef(null);
useEffect(()=> {
const img=new window.Image();
img.onload=()=> {
setImageSize({ width: img.width, height: img.height });
imageRef.current=img;
drawCanvas();
};
img.src=imageSrc;
}, [imageSrc]);
useEffect(()=> {
drawCanvas();
}, [crop, zoom, imageSize]);
const drawCanvas=()=> {
const canvas=canvasRef.current;
if(!canvas||!imageRef.current) return;
const ctx=canvas.getContext('2d');
const canvasSize=400;
canvas.width=canvasSize;
canvas.height=canvasSize;
ctx.fillStyle='#000';
ctx.fillRect(0, 0, canvasSize, canvasSize);
const maxDimension=Math.max(imageSize.width, imageSize.height);
const baseScale=canvasSize/maxDimension;
const scale=baseScale*zoom;
const imgWidth=imageSize.width*scale;
const imgHeight=imageSize.height*scale;
ctx.drawImage(
imageRef.current,
crop.x,
crop.y,
imgWidth,
imgHeight
);
ctx.fillStyle='rgba(0, 0, 0, 0.5)';
ctx.fillRect(0, 0, canvasSize, canvasSize);
ctx.globalCompositeOperation='destination-out';
ctx.beginPath();
ctx.arc(canvasSize/2, canvasSize/2, 150, 0, 2*Math.PI);
ctx.fill();
ctx.globalCompositeOperation='source-over';
ctx.strokeStyle='#fff';
ctx.lineWidth=3;
ctx.beginPath();
ctx.arc(canvasSize/2, canvasSize/2, 150, 0, 2*Math.PI);
ctx.stroke();
};
const handlePointerDown=(e)=> {
setIsDragging(true);
setDragStart({ x: e.clientX-crop.x, y: e.clientY-crop.y });
};
const handlePointerMove=(e)=> {
if(!isDragging) return;
setCrop({
x: e.clientX-dragStart.x,
y: e.clientY-dragStart.y
});
};
const handlePointerUp=()=> {
setIsDragging(false);
};
const handleCrop=()=> {
const canvas=canvasRef.current;
if(!canvas||!imageRef.current) return;
const outputCanvas=document.createElement('canvas');
const outputSize=300;
outputCanvas.width=outputSize;
outputCanvas.height=outputSize;
const outputCtx=outputCanvas.getContext('2d');
const canvasSize=400;
const cropRadius=150;
const centerX=canvasSize/2;
const centerY=canvasSize/2;
const maxDimension=Math.max(imageSize.width, imageSize.height);
const baseScale=canvasSize/maxDimension;
const scale=baseScale*zoom;
const imgWidth=imageSize.width*scale;
const imgHeight=imageSize.height*scale;
const sourceX=(centerX-cropRadius-crop.x)/scale;
const sourceY=(centerY-cropRadius-crop.y)/scale;
const sourceSize=(cropRadius*2)/scale;
outputCtx.beginPath();
outputCtx.arc(outputSize/2, outputSize/2, outputSize/2, 0, 2*Math.PI);
outputCtx.clip();
outputCtx.drawImage(
imageRef.current,
sourceX,
sourceY,
sourceSize,
sourceSize,
0,
0,
outputSize,
outputSize
);
const mimeType=outputCanvas.toDataURL('image/webp').indexOf('data:image/webp')===0
? 'image/webp'
: 'image/jpeg';
const croppedImage=outputCanvas.toDataURL(mimeType, 0.7);
crop(croppedImage);
};
return(
<div
className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
onClick={(e)=> {
 if(e.target===e.currentTarget) {
 cancel();
 }
}}
><div
 className="bg-white rounded shadow-xl w-full max-w-md"
 onClick={(e)=> e.stopPropagation()}
><div className="flex items-center justify-between p-4 border-b"><h3 className="text-lg font-bold text-gray-800">画像をクロップ</h3><button
  onClick={(e)=> {
  e.preventDefault();
  e.stopPropagation();
  cancel();
  }}
  className="p-2 hover:bg-gray-100 rounded"
 ><X size={20} /></button></div><div className="p-4 space-y-4" onClick={(e)=> e.stopPropagation()}><div className="relative"><canvas
  ref={canvasRef}
  width={400}
  height={400}
  className="w-full h-auto border border-gray-300 rounded cursor-move"
  onPointerDown={handlePointerDown}
  onPointerMove={handlePointerMove}
  onPointerUp={handlePointerUp}
  onPointerLeave={handlePointerUp}
  /></div><div className="space-y-2"><label className="block text-sm font-medium text-gray-700">
  ズーム: {zoom.toFixed(1)}x
  </label><input
  type="range"
  min="0.5"
  max="3"
  step="0.1"
  value={zoom}
  onChange={(e)=> setZoom(parseFloat(e.target.value))}
  className="w-full"
  /></div><div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
  💡 画像をドラッグして位置を調整し、スライダーでズームできます
 </div><div className="flex gap-2"><button
  onClick={(e)=> {
   e.preventDefault();
   e.stopPropagation();
   handleCrop();
  }}
  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 font-medium"
  >
  クロップ
  </button><button
  onClick={(e)=> {
   e.preventDefault();
   e.stopPropagation();
   cancel();
  }}
  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
  >
  キャンセル
  </button></div></div></div></div>
);
};
const MessageBubble=React.memo(({
message,
index,
character,
editIdx,
editCont,
sEditCont,
editEmo,
sEditEmo,
editAff,
sEditAff,
hEdit,
hSave,
hCancel,
hDel,
hFork,
showRegenPre,
sShowRegenPre,
regenPre,
sRegenPre,
hRegenGrp,
handleRegenerateFrom,
handleSwitchVersion,
showVers,
sShowVer,
loading,
showThinking,
sShowThink,
emotions
})=> {
const isUser=message.type==='user';
const isNarration=message.type==='narration';
const isCharacter=message.type==='character';
const toggleVersions=()=> {
sShowVer(prev=> ({
...prev,
[index]: !prev[index]
}));
};
return(
<div className={`flex ${
isNarration ? 'justify-center' : isUser ? 'justify-end' : 'justify-start'
}`}><div className={`${
 isNarration
 ? 'max-w-3xl bg-gray-50 border border-gray-300 rounded shadow-sm'
 : isUser
  ? 'max-w-4xl bg-blue-100 rounded-2xl rounded-tr-none shadow'
  : 'max-w-4xl bg-white rounded-2xl rounded-tl-none shadow'
} w-full p-4`}><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2">
  {isNarration ? (
  <><FileText size={18} className="text-gray-500" /><span className="font-medium text-sm text-gray-600">地の文</span></>
  ) : isUser ? (
  <><User size={20} className="text-blue-600" /><span className="font-semibold text-sm text-blue-600">あなた</span></>
  ) : (
  <><AvatarDisplay character={character} size="sm" /><span className="font-semibold text-sm text-indigo-600">
   {character?.name||'不明なキャラクター'}
   </span>
   {character?.features.emoOn&&message.emotion&&(
   <span className="text-lg" title={emotions[message.emotion]?.label}>
    {emotions[message.emotion]?.emoji}
   </span>
   )}
   {character?.features.affOn&&message.affection !==undefined&&(
   <div className="flex items-center gap-1 text-xs bg-red-50 px-2 py-1 rounded"><Heart size={12} className="text-red-500" /><span className="text-red-600 font-semibold">{message.affection}</span></div>
   )}
  </>
  )}
 </div><div className="flex gap-1"><button
  onClick={()=> hFork(index)}
  className="p-1 text-gray-500 hover:text-green-600"
  title="ここから分岐"
  ><Copy size={14} /></button><button
  onClick={()=> hEdit(index)}
  className="p-1 text-gray-500 hover:text-blue-600"
  title="編集"
  ><Edit2 size={14} /></button><button
  onClick={()=> hDel(index)}
  className="p-1 text-gray-500 hover:text-red-600"
  title="削除"
  ><Trash2 size={14} /></button>
  {!isUser&&(
  <button
   onClick={()=> sShowRegenPre(showRegenPre===index ? null : index)}
   className="p-1 text-gray-500 hover:text-purple-600"
   title="再生成"
  ><RotateCcw size={14} /></button>
  )}
 </div></div>
 {showRegenPre===index&&!isUser&&(
 <div className="mb-3 bg-purple-50 border border-purple-200 rounded p-3"><label className="block text-xs font-medium text-purple-700 mb-2">
  再生成プリフィル（オプション）
  </label><input
  type="text"
  value={regenPre}
  onChange={(e)=> sRegenPre(e.target.value)}
  placeholder={
   message.type==='narration'
   ? "例: もっと緊張感のある描写で"
   : `例: ${character?.name}の性格をより強調して`
  }
  className="w-full px-3 py-2 border border-purple-300 rounded text-sm mb-3"
  /><div className="flex gap-2"><button
   onClick={()=> hRegenGrp(index)}
   className="flex-1 px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 text-xs font-medium flex items-center justify-center gap-1"
   disabled={loading}
   title="同じグループ内のこのバブル以降を再生成"
  ><RotateCcw size={12} />
   ここから（グループ内）
  </button><button
   onClick={()=> handleRegenerateFrom(index)}
   className="flex-1 px-3 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-xs font-medium flex items-center justify-center gap-1"
   disabled={loading}
   title="このバブル以降の全メッセージを再生成"
  ><SkipForward size={12} />
   ここから（全体）
  </button></div><button
  onClick={()=> { sShowRegenPre(null); sRegenPre(''); }}
  className="w-full mt-2 px-3 py-1.5 bg-gray-400 text-white rounded hover:bg-gray-500 text-xs"
  >
  キャンセル
  </button></div>
 )}
 {message.thinking&&(
 <div className="mb-3 border-l-4 border-yellow-400 bg-yellow-50 p-3 rounded"><div className="flex items-center justify-between mb-2"><span className="text-xs font-semibold text-yellow-700">💭 思考</span><button
   onClick={()=> sShowThink(prev=> ({ ...prev, [index]: !(prev[index] ?? true) }))}
   className="text-yellow-600 hover:bg-yellow-100 p-1 rounded transition cursor-pointer"
  >
   {(showThinking[index] ?? true) ? <EyeOff size={14} /> : <Eye size={14} />}
  </button></div>
  {(showThinking[index] ?? true)&&(
  <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono bg-white p-2 rounded max-h-40 overflow-y-auto">
   {message.thinking}
  </pre>
  )}
 </div>
 )}
 {editIdx===index ? (
 <div className="space-y-2"><textarea
  value={editCont}
  onChange={(e)=> sEditCont(e.target.value)}
  className="w-full p-3 border border-gray-300 rounded text-sm"
  rows={10}
  />
  {!isNarration&&!isUser&&character&&(character.features.emoOn||character.features.affOn)&&(
  <div className={`gap-3 ${character.features.emoOn&&character.features.affOn ? 'grid grid-cols-2' : 'flex flex-col'}`}>
   {character.features.emoOn&&(
   <div><label className="block text-xs font-medium text-gray-700 mb-1">感情</label><select
    value={editEmo||''}
    onChange={(e)=> sEditEmo(e.target.value||null)}
    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
    ><option value="">なし</option>
    {Object.entries(emotions).map(([key, value])=> (
     <option key={key} value={key}>
     {value.emoji} {value.label}
     </option>
    ))}
    </select></div>
   )}
   {character.features.affOn&&(
   <div><label className="block text-xs font-medium text-gray-700 mb-1">好感度 (0-100)</label><input
    type="number"
    min="0"
    max="100"
    value={editAff !==null ? editAff : ''}
    onChange={(e)=> {
     const val=e.target.value==='' ? null : Math.max(0, Math.min(100, parseInt(e.target.value)||0));
     sEditAff(val);
    }}
    placeholder="なし"
    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
    /></div>
   )}
  </div>
  )}
  <div className="flex gap-2"><button
   onClick={()=> hSave(index)}
   className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
  >
   保存
  </button><button
   onClick={hCancel}
   className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
  >
   キャンセル
  </button></div></div>
 ) : (
 <><pre className="whitespace-pre-wrap font-sans text-gray-800 text-sm leading-relaxed">
  {message.content}
  </pre>
  {}
  {message.alternatives&&message.alternatives.length > 1&&(
  <div className="mt-3 pt-3 border-t border-gray-200"><div className="flex items-center justify-between"><button
    onClick={toggleVersions}
    className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-800 transition"
   ><History size={14} /><span>{message.alternatives.length}つのバージョン</span>
    {showVers[index] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
   </button></div>
   {showVers[index]&&(
   <div className="mt-2 space-y-1">
    {message.alternatives.slice().reverse().map((alt, i)=> {
    const versionNumber=message.alternatives.length-i;
    return(
     <button
     key={alt.id}
     onClick={()=> handleSwitchVersion(index, alt.id)}
     className={`w-full text-left px-3 py-2 rounded text-xs transition ${
      alt.isActive
      ? 'bg-purple-100 border border-purple-300 text-purple-700 font-medium'
      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
     }`}
     >
     {alt.isActive&&'✓ '}
     バージョン{versionNumber}
     <span className="text-gray-500 ml-2">
      ({new Date(alt.ts).toLocaleTimeString()})
     </span></button>
    );
    })}
   </div>
   )}
  </div>
  )}
 </>
 )}
</div></div>
);
}, (prevProps, nextProps)=> {
return prevProps.message.content===nextProps.message.content &&
 prevProps.message.ts===nextProps.message.ts &&
 prevProps.editIdx===nextProps.editIdx &&
 prevProps.editCont===nextProps.editCont &&
 prevProps.editEmo===nextProps.editEmo &&
 prevProps.editAff===nextProps.editAff &&
 prevProps.showRegenPre===nextProps.showRegenPre &&
 prevProps.regenPre===nextProps.regenPre &&
 prevProps.showVers?.[nextProps.index]===nextProps.showVers?.[nextProps.index] &&
 prevProps.character?.id===nextProps.character?.id;
});
const ConversationListItem=React.memo(({
conversation,
isActive,
select,
onEditTitle,
onExport,
onDelete,
editConvTitle,
editTitle,
sEditTitle,
sEditConvTitle,
updConv
})=> {
return(
<div
className={`group rounded transition ${
 isActive
 ? 'bg-indigo-100 border-2 border-indigo-500'
 : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
}`}
><div className="flex items-start gap-2 p-2"><button
 onClick={()=> select(conversation.id)}
 className="flex-1 text-left min-w-0"
 ><div className="flex items-center gap-2 mb-1">
  {isActive&&<Check size={12} className="text-indigo-600 flex-shrink-0" />}
  {editConvTitle===conversation.id ? (
  <input
   type="text"
   value={editTitle}
   onChange={(e)=> sEditTitle(e.target.value)}
   onKeyDown={(e)=> {
   if(e.key==='Enter') {
    updConv(conversation.id, { title: editTitle });
    sEditConvTitle(null);
   } else if(e.key==='Escape') {
    sEditConvTitle(null);
   }
   }}
   onClick={(e)=> e.stopPropagation()}
   onBlur={()=> {
   updConv(conversation.id, { title: editTitle });
   sEditConvTitle(null);
   }}
   autoFocus
   className="flex-1 px-2 py-0.5 text-sm font-semibold border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
  />
  ) : (
  <span className="font-semibold text-sm truncate">{conversation.title}</span>
  )}
 </div><div className="flex items-center justify-between text-xs text-gray-500"><span>{conversation.messages.length}件</span><span className="flex items-center gap-1"><Users size={10} />
  {conversation.partIds.length}
  </span></div></button><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0"><button
  onClick={(e)=> {
  e.stopPropagation();
  onEditTitle(conversation.id, conversation.title);
  }}
  className="p-1 hover:bg-blue-100 rounded"
  title="タイトル編集"
 ><Edit2 size={12} className="text-blue-600" /></button><button
  onClick={(e)=> {
  e.stopPropagation();
  onExport(conversation.id);
  }}
  className="p-1 hover:bg-green-100 rounded"
  title="エクスポート"
 ><Download size={12} className="text-green-600" /></button><button
  onClick={(e)=> {
  e.stopPropagation();
  onDelete(conversation.id);
  }}
  className="p-1 hover:bg-red-100 rounded"
  title="削除"
 ><Trash2 size={12} className="text-red-600" /></button></div></div></div>
);
}, (prevProps, nextProps)=> {
return prevProps.conversation.id===nextProps.conversation.id &&
 prevProps.conversation.title===nextProps.conversation.title &&
 prevProps.conversation.upd===nextProps.conversation.upd &&
 prevProps.conversation.messages.length===nextProps.conversation.messages.length &&
 prevProps.conversation.partIds.length===nextProps.conversation.partIds.length &&
 prevProps.isActive===nextProps.isActive &&
 prevProps.editConvTitle===nextProps.editConvTitle &&
 prevProps.editTitle===nextProps.editTitle;
});
const ConversationSettingsPanel=React.memo(({ conversation, characters, update, close })=> {
const [localTitle, setLocalTitle]=useState(conversation.title);
const [localBackground, setLocalBackground]=useState(conversation.backgroundInfo);
const [localNarration, setLocalNarration]=useState(conversation.narrOn);
const [localAutoNarration, setLocalAutoNarration]=useState(conversation.autoGenerateNarration||false);
const [localParticipants, setLocalParticipants]=useState(conversation.partIds);
const [localRelationships, setLocalRelationships]=useState(conversation.relationships||[]);
const relationshipTypes=['友人', '親友', '恋人', 'ライバル', '家族', '師弟', '同僚', 'その他'];
const toggleParticipant=(charId)=> {
setLocalParticipants(prev=>
prev.includes(charId)
 ? prev.filter(id=> id !==charId)
 : [...prev, charId]
);
};
const addRelationship=()=> {
if(localParticipants.length < 1) return;
setLocalRelationships(prev=> [...prev, {
char1Id: localParticipants[0],
char2Id: localParticipants.length >=2 ? localParticipants[1] : '__user__',
type: '友人',
desc: ''
}]);
};
const updateRelationship=(index, field, value)=> {
setLocalRelationships(prev=> {
const upd=[...prev];
upd[index]={ ...upd[index], [field]: value };
return upd;
});
};
const deleteRelationship=(index)=> {
setLocalRelationships(prev=> prev.filter((_, i)=> i !==index));
};
const handleSave=()=> {
update({
title: localTitle,
backgroundInfo: localBackground,
narrOn: localNarration,
autoGenerateNarration: localAutoNarration,
partIds: localParticipants,
relationships: localRelationships
});
close();
};
return(
<div
className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto"
style={{ zIndex: 50 }}
><div
 className="bg-white rounded shadow-xl w-full max-w-3xl my-8 flex flex-col"
 style={{ maxHeight: 'calc(100vh-4rem)' }}
 onClick={(e)=> e.stopPropagation()}
><div className="bg-white border-b p-4 flex items-center justify-between flex-shrink-0"><h3 className="font-semibold text-xl text-indigo-600 flex items-center gap-2"><Users size={24} />
  会話設定
 </h3><button onClick={close} className="p-2 hover:bg-gray-100 rounded transition"><X size={20} /></button></div><div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ minHeight: 0 }}><div><label className="block text-sm font-medium text-gray-700 mb-1">会話タイトル</label><input
 type="text"
 value={localTitle}
 onChange={(e)=> setLocalTitle(e.target.value)}
 className="w-full px-3 py-2 border border-gray-300 rounded"
 /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">
 背景情報・シチュエーション
 </label><textarea
 value={localBackground}
 onChange={(e)=> setLocalBackground(e.target.value)}
 placeholder="例: 学園の文化祭準備中。主人公は実行委員長。キャラクターたちは各自の出し物の準備をしている。"
 className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
 rows={4}
 /></div><div className="space-y-2"><label className="flex items-center gap-2"><input
  type="checkbox"
  checked={localNarration}
  onChange={(e)=> setLocalNarration(e.target.checked)}
  className="w-4 h-4"
 /><span className="text-sm font-medium text-gray-700">地の文を有効化</span></label><p className="text-xs text-gray-500 ml-6">
 情景描写や行動描写などのナレーションを追加できます
 </p>
 {localNarration&&(
 <div className="ml-6 mt-2 p-3 bg-purple-50 border border-purple-200 rounded"><label className="flex items-center gap-2"><input
   type="checkbox"
   checked={localAutoNarration}
   onChange={(e)=> setLocalAutoNarration(e.target.checked)}
   className="w-4 h-4"
  /><span className="text-sm font-medium text-purple-700">AIが自動で地の文を生成</span></label><p className="text-xs text-purple-600 mt-1 ml-6">
  会話の合間に自動的に情景描写や行動描写を挿入します
  </p></div>
 )}
</div><div><label className="block text-sm font-medium text-gray-700 mb-2">
 参加キャラクター ({localParticipants.length}人)
 </label>
 {characters.length===0 ? (
 <p className="text-sm text-gray-500">キャラクターが登録されていません</p>
 ) : (
 <div className="space-y-2 max-h-48 overflow-y-auto">
  {characters.map(char=> (
  <label
   key={char.id}
   className="flex items-center gap-3 p-2 border rounded hover:bg-gray-50 cursor-pointer"
  ><input
   type="checkbox"
   checked={localParticipants.includes(char.id)}
   onChange={()=> toggleParticipant(char.id)}
   className="w-4 h-4"
   /><AvatarDisplay character={char} size="sm" /><div className="flex-1"><div className="font-medium text-sm">{char.name}</div><div className="text-xs text-gray-500">{char.definition.pers}</div></div></label>
  ))}
 </div>
 )}
</div><div><div className="flex items-center justify-between mb-2"><label className="block text-sm font-medium text-gray-700">
  キャラクター間の関係性 ({localRelationships.length}件)
 </label><button
  onClick={addRelationship}
  disabled={localParticipants.length < 1}
  className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition disabled:bg-gray-100 disabled:text-gray-400 flex items-center gap-1"
 ><Plus size={14} />
  追加
 </button></div>
 {localParticipants.length < 1 ? (
 <p className="text-xs text-gray-500">1人以上のキャラクターを追加すると関係性を設定できます</p>
 ) : localRelationships.length===0 ? (
 <p className="text-xs text-gray-500">関係性を追加して、キャラクター間の繋がりを定義できます</p>
 ) : (
 <div className="space-y-3 max-h-48 overflow-y-auto">
  {localRelationships.map((rel, idx)=> (
  <div key={idx} className="p-3 border rounded bg-gray-50 space-y-2"><div className="flex items-center gap-2"><select
    value={rel.char1Id}
    onChange={(e)=> updateRelationship(idx, 'char1Id', e.target.value)}
    className="flex-1 px-2 py-1 text-sm border rounded"
   ><option value="__user__">あなた</option>
    {localParticipants.map(charId=> {
    const char=characters.find(c=> c.id===charId);
    return char ? (
     <option key={charId} value={charId}>{char.name}</option>
    ) : null;
    })}
   </select><span className="text-xs text-gray-500">と</span><select
    value={rel.char2Id}
    onChange={(e)=> updateRelationship(idx, 'char2Id', e.target.value)}
    className="flex-1 px-2 py-1 text-sm border rounded"
   ><option value="__user__">あなた</option>
    {localParticipants.map(charId=> {
    const char=characters.find(c=> c.id===charId);
    return char ? (
     <option key={charId} value={charId}>{char.name}</option>
    ) : null;
    })}
   </select></div><select
   value={rel.type}
   onChange={(e)=> updateRelationship(idx, 'type', e.target.value)}
   className="w-full px-2 py-1 text-sm border rounded"
   >
   {relationshipTypes.map(type=> (
    <option key={type} value={type}>{type}</option>
   ))}
   </select><div className="flex gap-2"><input
    type="text"
    value={rel.desc}
    onChange={(e)=> updateRelationship(idx, 'desc', e.target.value)}
    placeholder="詳細な説明（オプション）"
    className="flex-1 px-2 py-1 text-sm border rounded"
   /><button
    onClick={()=> deleteRelationship(idx)}
    className="p-1 text-red-600 hover:bg-red-100 rounded"
    title="削除"
   ><Trash2 size={14} /></button></div></div>
  ))}
 </div>
 )}
</div></div><div className="sticky bottom-0 bg-white border-t p-4 flex gap-2 flex-shrink-0"><button
  onClick={handleSave}
  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium transition"
 >
  保存
 </button><button
  onClick={close}
  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition"
 >
  キャンセル
 </button></div></div></div>
);
}, (prevProps, nextProps)=> {
return prevProps.conversation?.id===nextProps.conversation?.id &&
 prevProps.conversation?.upd===nextProps.conversation?.upd &&
 prevProps.characters.length===nextProps.characters.length;
});
const CharacterModal=React.memo(({ characters, sChars, charGrps, sCharGrps, getDefaultCharacter, expChar, impChar, charFileRef, emotions, close })=> {
const [editingChar, setEditingChar]=useState(null);
const [isNew, setIsNew]=useState(false);
const [isDerived, setIsDerived]=useState(false);
const [viewTab, setViewTab]=useState('characters');
const [editingGroup, setEditingGroup]=useState(null);
const [searchQuery, setSearchQuery]=useState('');
const [debouncedSearchQuery, setDebouncedSearchQuery]=useState('');
const [showEmojiPicker, setShowEmojiPicker]=useState(false);
const [showImageCropper, setShowImageCropper]=useState(false);
const [uploadedImage, setUploadedImage]=useState(null);
const [isDragging, setIsDragging]=useState(false);
const [lastSavedCharacterId, setLastSavedCharacterId]=useState(null);
const avatarImageInputRef=useRef(null);
const [showAutoSetupModal, setShowAutoSetupModal]=useState(false);
const [autoSetupMode, setAutoSetupMode]=useState('template');
const [autoSetupCharName, setAutoSetupCharName]=useState('');
const [autoSetupWorkName, setAutoSetupWorkName]=useState('');
const [autoSetupAdditionalInfo, setAutoSetupAdditionalInfo]=useState('');
const [simpleDescription, setSimpleDescription]=useState('');
const [isGeneratingCharacter, setIsGeneratingCharacter]=useState(false);
const [genCharPrev, setGeneratedCharacterPreview]=useState(null);
const [generatedTemplate, setGeneratedTemplate]=useState(null);
const [genErr, setGenerationError]=useState(null);
const debouncedSearch=useMemo(
()=> debounce((query)=> {
setDebouncedSearchQuery(query);
}, 300),
[]
);
useEffect(()=> {
debouncedSearch(searchQuery);
}, [searchQuery, debouncedSearch]);
const filteredCharacters=useMemo(()=> {
return characters.filter(char=> {
if(!debouncedSearchQuery) return true;
const query=debouncedSearchQuery.toLowerCase();
return char.name.toLowerCase().includes(query) ||
  char.definition.pers?.toLowerCase().includes(query) ||
  char.definition.background?.toLowerCase().includes(query);
});
}, [characters, debouncedSearchQuery]);
const handleCreate=()=> {
const newChar=getDefaultCharacter();
setEditingChar(newChar);
setIsNew(true);
setIsDerived(false);
};
const handleCreateDerived=(baseChar)=> {
const newChar={
...getDefaultCharacter(),
name: `${baseChar.name}（派生）`,
baseCharacterId: baseChar.id,
overrides: {}
};
setEditingChar(newChar);
setIsNew(true);
setIsDerived(true);
};
const hEdit=(char)=> {
setEditingChar(JSON.parse(JSON.stringify(char)));
setIsNew(false);
setIsDerived(!!char.baseCharacterId);
};
const toggleOverride=(field)=> {
if(!editingChar) return;
const newOverrides={ ...editingChar.overrides };
if(newOverrides[field]) {
delete newOverrides[field];
} else {
newOverrides[field]=true;
}
setEditingChar({
...editingChar,
overrides: newOverrides
});
};
const updateEditingField=(path, value)=> {
setEditingChar(prev=> {
const upd={ ...prev };
const keys=path.split('.');
let current=upd;
for(let i=0; i < keys.length-1; i++) {
 current=current[keys[i]];
}
current[keys[keys.length-1]]=value;
return upd;
});
};
const handleStartAutoSetup=()=> {
setShowAutoSetupModal(true);
setAutoSetupMode('template');
setAutoSetupCharName('');
setAutoSetupWorkName('');
setAutoSetupAdditionalInfo('');
setSimpleDescription('');
setGeneratedCharacterPreview(null);
setGeneratedTemplate(null);
setGenerationError(null);
};
const handleCancelAutoSetup=()=> {
setShowAutoSetupModal(false);
setAutoSetupMode('template');
setAutoSetupCharName('');
setAutoSetupWorkName('');
setAutoSetupAdditionalInfo('');
setSimpleDescription('');
setGeneratedCharacterPreview(null);
setGeneratedTemplate(null);
setGenerationError(null);
setIsGeneratingCharacter(false);
};
const handleGenerateTemplate=()=> {
if(!autoSetupCharName.trim()) {
alert('キャラクター名を入力してください');
return;
}
const characterInfo=`キャラクター名: ${autoSetupCharName}${autoSetupWorkName ? `\n作品名: ${autoSetupWorkName}` : ''}${autoSetupAdditionalInfo ? `\n追加情報: ${autoSetupAdditionalInfo}` : ''}`;
const prompt=`あなたはキャラクター設定の専門家です。以下のキャラクターについて、Web検索を使って正確な情報を収集し、会話アプリ用のキャラクター設定を生成してください。
${characterInfo}
**重要: Web検索を使用して、このキャラクターの正確な情報を収集してください。**
以下のJSON形式で出力してください。JSONのみを出力し、説明文やコードブロック記号は不要です。
{
"id": "char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}",
"name": "${autoSetupCharName}",
"baseCharacterId": null,
"overrides": {},
"definition": {
"pers": "性格を1文で簡潔に（例: 優しく真面目で責任感が強い）",
"speakingStyle": "話し方を1文で簡潔に（例: 丁寧で誠実な口調）",
"firstPerson": "一人称（原作で使用している一人称）",
"secondPerson": "二人称（原作で使用している二人称）",
"background": "背景やバックストーリー（3-5文程度、原作の設定に基づく）",
"phrases": ["決め台詞1", "決め台詞2", "決め台詞3"],
"custPrompt": "【重要】ここに詳細なキャラクター情報を記述してください：\n\n# 性格の詳細\n- 基本的な性格特性（原作に基づく詳細な説明）\n- 価値観や信念\n- 行動パターンや癖\n- 感情表現の特徴\n\n# 話し方の詳細\n- 具体的な口調や語尾の使い方\n- よく使うフレーズや言い回し\n- 感情による話し方の変化\n- 特定の相手への話し方の違い\n\n# 関係性と振る舞い\n- 他者との接し方\n- 親しい人への態度\n- 初対面の人への態度\n\n# その他の特徴\n- 趣味や好きなもの\n- 苦手なことや嫌いなもの\n- 特技や能力\n- 原作での重要なエピソード\n\nこの情報を使ってキャラクターを演じてください。"
},
"features": {
"emoOn": true,
"affOn": true,
"autoEmo": true,
"autoAff": true,
"curEmo": "neutral",
"affLvl": 50,
"avatar": "😊",
"avType": "emoji",
"avatImg": null
},
"cre": "${new Date().toISOString()}",
"upd": "${new Date().toISOString()}"
}
Web検索で得た情報を元に、原作に忠実で自然なキャラクター設定を作成してください。
特に **custPrompt** に詳細な情報を記述し、pers/speakingStyle は簡潔なラベルとして記入してください。`;
const jsonTemplate={
id: `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
name: autoSetupCharName,
baseCharacterId: null,
overrides: {},
definition: {
 pers: "性格を1文で簡潔に",
 speakingStyle: "話し方を1文で簡潔に",
 firstPerson: "一人称",
 secondPerson: "二人称",
 background: "背景やバックストーリー（3-5文程度）",
 phrases: ["決め台詞1", "決め台詞2", "決め台詞3"],
 custPrompt: `【重要】ここに詳細なキャラクター情報を記述してください：
# 性格の詳細
- 基本的な性格特性（原作に基づく詳細な説明）
- 価値観や信念
- 行動パターンや癖
- 感情表現の特徴
# 話し方の詳細
- 具体的な口調や語尾の使い方
- よく使うフレーズや言い回し
- 感情による話し方の変化
- 特定の相手への話し方の違い
# 関係性と振る舞い
- 他者との接し方
- 親しい人への態度
- 初対面の人への態度
# その他の特徴
- 趣味や好きなもの
- 苦手なことや嫌いなもの
- 特技や能力
- 原作での重要なエピソード
この情報を使ってキャラクターを演じてください。`
},
features: {
 emoOn: true,
 affOn: true,
 autoEmo: true,
 autoAff: true,
 curEmo: "neutral",
 affLvl: 50,
 avatar: "😊",
 avType: "emoji",
 avatImg: null
},
cre: new Date().toISOString(),
upd: new Date().toISOString()
};
setGeneratedTemplate({
prompt: prompt,
jsonTemplate: JSON.stringify(jsonTemplate, null, 2),
fileName: `character_${autoSetupCharName}_${new Date().toISOString().slice(0, 10)}.json`
});
};
const handleCopyTemplate=async (text)=> {
try {
await navigator.clipboard.writeText(text);
alert('クリップボードにコピーしました！');
} catch (error) {
console.error('Copy failed:', error);
alert('コピーに失敗しました。手動でコピーしてください。');
}
};
const handleDownloadTemplate=()=> {
if(!generatedTemplate) return;
const blob=new Blob([generatedTemplate.jsonTemplate], { type: 'application/json' });
const url=URL.createObjectURL(blob);
const a=document.createElement('a');
a.href=url;
a.download=generatedTemplate.fileName;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
};
const handleGenerateFromSimple=async ()=> {
if(!simpleDescription.trim()) {
alert('キャラクターの説明を入力してください');
return;
}
setIsGeneratingCharacter(true);
setGenerationError(null);
try {
const prompt=`以下の簡単な説明から、会話アプリ用の詳細なキャラクター設定を生成してください。
キャラクターの説明:
${simpleDescription}
以下のJSON形式で出力してください。JSONのみを出力し、説明文やコードブロック記号は不要です。
{
"name": "キャラクター名（説明から適切な名前を考案、または「新しいキャラクター」）",
"pers": "性格を1文で簡潔に（例: 明るく社交的で前向き）",
"speakingStyle": "話し方を1文で簡潔に（例: フレンドリーで親しみやすい口調）",
"firstPerson": "一人称（「私」「僕」「俺」など、性格に合ったもの）",
"secondPerson": "二人称（「あなた」「君」「お前」など、性格に合ったもの）",
"background": "背景やバックストーリー（3-5文程度、説明を元に具体的に）",
"phrases": ["決め台詞1", "決め台詞2", "決め台詞3"],
"custPrompt": "【重要】ここに詳細なキャラクター情報を記述してください：\\n\\n# 性格の詳細\\n- 基本的な性格特性（説明を元に詳細に）\\n- 価値観や信念\\n- 行動パターンや癖\\n- 感情表現の特徴\\n\\n# 話し方の詳細\\n- 具体的な口調や語尾の使い方（「〜だよ」「〜です」など）\\n- よく使うフレーズや言い回し\\n- 感情による話し方の変化\\n- 特定の相手への話し方の違い\\n\\n# 関係性と振る舞い\\n- 他者との接し方\\n- 親しい人への態度\\n- 初対面の人への態度\\n\\n# その他の特徴\\n- 趣味や好きなもの\\n- 苦手なことや嫌いなもの\\n- 特技や能力\\n\\nこの情報を使ってキャラクターを演じてください。"
}
説明から想像を膨らませて、魅力的で自然なキャラクター設定を作成してください。
特に **custPrompt** に詳細な情報を記述し、pers/speakingStyle は簡潔なラベルとして記入してください。`;
const response=await fetch('https://api.anthropic.com/v1/messages', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 model: 'claude-sonnet-4-20250514',
 max_tokens: 2000,
 messages: [{
  role: 'user',
  content: prompt
 }]
 })
});
if(!response.ok) {
 throw new Error(`API Error: ${response.status}`);
}
const data=await response.json();
const content=data.content[0].text;
let jsonText=content;
const jsonMatch=content.match(/```json\s*([\s\S]*?)\s*```/)||content.match(/```\s*([\s\S]*?)\s*```/);
if(jsonMatch) {
 jsonText=jsonMatch[1];
}
const characterData=JSON.parse(jsonText.trim());
setGeneratedCharacterPreview(characterData);
} catch (error) {
console.error('Character generation error:', error);
setGenerationError(error.message||'キャラクター生成中にエラーが発生しました');
} finally {
setIsGeneratingCharacter(false);
}
};
const hApplyGen=()=> {
if(!genCharPrev) return;
const newChar={
...getDefaultCharacter(),
name: genCharPrev.name||'新しいキャラクター',
definition: {
 pers: genCharPrev.pers||'',
 speakingStyle: genCharPrev.speakingStyle||'',
 firstPerson: genCharPrev.firstPerson||'私',
 secondPerson: genCharPrev.secondPerson||'あなた',
 background: genCharPrev.background||'',
 phrases: genCharPrev.phrases||[],
 custPrompt: genCharPrev.custPrompt||''
}
};
setEditingChar(newChar);
setIsNew(true);
setIsDerived(false);
setShowAutoSetupModal(false);
setAutoSetupCharName('');
setAutoSetupWorkName('');
setAutoSetupAdditionalInfo('');
setGeneratedCharacterPreview(null);
setGenerationError(null);
};
const handleSave=()=> {
const savedCharId=editingChar.id;
if(isNew) {
sChars(prev=> [...prev, editingChar]);
} else {
sChars(prev=> prev.map(c=> c.id===editingChar.id ? editingChar : c));
}
setEditingChar(null);
setIsNew(false);
setIsDerived(false);
setLastSavedCharacterId(savedCharId);
setTimeout(()=> {
setLastSavedCharacterId(null);
}, 3000);
};
const hDel=(charId)=> {
const hasDerived=characters.some(c=> c.baseCharacterId===charId);
if(hasDerived&&!confirm('このキャラクターから派生したキャラクターが存在します。削除すると派生キャラクターも影響を受けます。続けますか？')) {
return;
}
sChars(prev=> prev.filter(c=> c.id !==charId));
};
const getBaseCharacter=(charId)=>characters.find(c=> c.id===charId);
const isOverridden=(char, field)=> {
if(!char.baseCharacterId) return false;
return !!char.overrides[field];
};
const handleAvatarImageUpload=(event)=> {
const file=event.target.files[0];
if(!file) return;
if(!file.type.startsWith('image/')) {
alert('画像ファイルを選択してください');
return;
}
const reader=new FileReader();
reader.onload=(e)=> {
setUploadedImage(e.target.result);
setShowImageCropper(true);
};
reader.readAsDataURL(file);
event.target.value='';
};
const handleDragOver=(e)=> {
e.preventDefault();
e.stopPropagation();
setIsDragging(true);
};
const handleDragEnter=(e)=> {
e.preventDefault();
e.stopPropagation();
setIsDragging(true);
};
const handleDragLeave=(e)=> {
e.preventDefault();
e.stopPropagation();
const rect=e.currentTarget.getBoundingClientRect();
const x=e.clientX;
const y=e.clientY;
if(x <=rect.left||x >=rect.right||y <=rect.top||y >=rect.bottom) {
setIsDragging(false);
}
};
const handleDrop=(e)=> {
e.preventDefault();
e.stopPropagation();
setIsDragging(false);
const files=e.dataTransfer.files;
if(files.length===0) return;
const file=files[0];
if(!file.type.startsWith('image/')) {
alert('画像ファイルをドロップしてください');
return;
}
const reader=new FileReader();
reader.onload=(event)=> {
setUploadedImage(event.target.result);
setShowImageCropper(true);
};
reader.readAsDataURL(file);
};
const handleImageCrop=(croppedImage)=> {
setEditingChar({
...editingChar,
features: {
 ...editingChar.features,
 avType: 'image',
 avatImg: croppedImage
}
});
setShowImageCropper(false);
setUploadedImage(null);
};
return(
<div
className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto"
style={{ zIndex: 50 }}
><div
 className="bg-white rounded shadow-xl w-full max-w-4xl my-8 flex flex-col"
 style={{ maxHeight: 'calc(100vh-4rem)' }}
 onClick={(e)=> e.stopPropagation()}
><div className="flex items-center justify-between p-4 border-b flex-shrink-0"><div className="flex items-center gap-3"><h2 className="text-xl font-bold text-indigo-600">キャラクター管理</h2>
  {editingChar&&(
  <div className="flex items-center gap-2"><span className="text-gray-400">›</span><span className="text-lg font-semibold text-gray-700">
   {isNew ? (isDerived ? '派生キャラクター作成' : '新規キャラクター作成') : 'キャラクター編集'}
   </span></div>
  )}
 </div><div className="flex items-center gap-2">
  {editingChar&&(
  <button
   onClick={(e)=> {
   e.preventDefault();
   e.stopPropagation();
   setEditingChar(null);
   setIsNew(false);
   }}
   className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded flex items-center gap-1"
  >
   ← 一覧に戻る
  </button>
  )}
  <button
  onClick={(e)=> {
   e.preventDefault();
   e.stopPropagation();
   close();
  }}
  className="p-2 hover:bg-gray-100 rounded"
  ><X size={20} /></button></div></div><div className="overflow-y-auto p-4 flex-1" style={{ minHeight: 0 }}>
 {editingChar ? (
  <div className="space-y-3">
  {isDerived&&editingChar.baseCharacterId&&(
   <div className="bg-purple-50 border border-purple-200 rounded p-3"><div className="flex items-center gap-2 text-sm text-purple-800"><Layers size={14} /><span className="font-semibold">派生元:</span><span>{getBaseCharacter(editingChar.baseCharacterId)?.name||'不明'}</span></div><p className="text-xs text-purple-600 mt-1">
    チェックを入れた項目のみカスタマイズできます。未チェックは派生元の値を継承します。
   </p></div>
  )}
  <div><div className="flex items-center justify-between mb-1"><label className="block text-sm font-medium">名前 *</label>
   {isDerived&&(
    <label className="flex items-center gap-1 text-xs text-purple-600"><input
     type="checkbox"
     checked={editingChar.overrides.name}
     onChange={()=> toggleOverride('name')}
     className="w-3 h-3"
    />
    カスタマイズ
    </label>
   )}
   </div><input
   type="text"
   value={editingChar.name}
   onChange={(e)=> setEditingChar({...editingChar, name: e.target.value})}
   className="w-full px-3 py-2 border rounded"
   disabled={isDerived&&!editingChar.overrides.name}
   /></div><div className={`${editingChar.baseCharacterId&&isOverridden(editingChar, 'pers') ? 'bg-yellow-50 border-yellow-200' : ''} border rounded p-3`}><div className="flex items-center justify-between mb-1"><label className="block text-sm font-medium">
    性格
    {editingChar.baseCharacterId&&isOverridden(editingChar, 'pers')&&(
    <span className="ml-2 text-xs text-yellow-600">（オーバーライド中）</span>
    )}
   </label>
   {isDerived&&(
    <label className="flex items-center gap-1 text-xs text-purple-600"><input
     type="checkbox"
     checked={editingChar.overrides.pers}
     onChange={()=> toggleOverride('pers')}
     className="w-3 h-3"
    />
    カスタマイズ
    </label>
   )}
   </div><input
   type="text"
   value={editingChar.definition.pers}
   onChange={(e)=> setEditingChar({
    ...editingChar,
    definition: {...editingChar.definition, pers: e.target.value}
   })}
   className="w-full px-3 py-2 border rounded"
   disabled={isDerived&&!editingChar.overrides.pers}
   /></div><div className={`${editingChar.baseCharacterId&&isOverridden(editingChar, 'speakingStyle') ? 'bg-yellow-50 border-yellow-200' : ''} border rounded p-3`}><div className="flex items-center justify-between mb-1"><label className="block text-sm font-medium">
    話し方
    {editingChar.baseCharacterId&&isOverridden(editingChar, 'speakingStyle')&&(
    <span className="ml-2 text-xs text-yellow-600">（オーバーライド中）</span>
    )}
   </label>
   {isDerived&&(
    <label className="flex items-center gap-1 text-xs text-purple-600"><input
     type="checkbox"
     checked={editingChar.overrides.speakingStyle}
     onChange={()=> toggleOverride('speakingStyle')}
     className="w-3 h-3"
    />
    カスタマイズ
    </label>
   )}
   </div><input
   type="text"
   value={editingChar.definition.speakingStyle}
   onChange={(e)=> setEditingChar({
    ...editingChar,
    definition: {...editingChar.definition, speakingStyle: e.target.value}
   })}
   className="w-full px-3 py-2 border rounded"
   disabled={isDerived&&!editingChar.overrides.speakingStyle}
   /></div><div className="grid grid-cols-2 gap-3"><div className={`${editingChar.baseCharacterId&&isOverridden(editingChar, 'firstPerson') ? 'bg-yellow-50 border-yellow-200' : ''} border rounded p-3`}><div className="flex items-center justify-between mb-1"><label className="block text-sm font-medium">
    一人称
    {editingChar.baseCharacterId&&isOverridden(editingChar, 'firstPerson')&&(
     <span className="ml-2 text-xs text-yellow-600">（上書き）</span>
    )}
    </label>
    {isDerived&&(
    <label className="flex items-center gap-1 text-xs text-purple-600"><input
     type="checkbox"
     checked={editingChar.overrides.firstPerson}
     onChange={()=> toggleOverride('firstPerson')}
     className="w-3 h-3"
     /></label>
    )}
   </div><input
    type="text"
    value={editingChar.definition.firstPerson}
    onChange={(e)=> setEditingChar({
    ...editingChar,
    definition: {...editingChar.definition, firstPerson: e.target.value}
    })}
    className="w-full px-3 py-2 border rounded"
    disabled={isDerived&&!editingChar.overrides.firstPerson}
   /></div><div className={`${editingChar.baseCharacterId&&isOverridden(editingChar, 'secondPerson') ? 'bg-yellow-50 border-yellow-200' : ''} border rounded p-3`}><div className="flex items-center justify-between mb-1"><label className="block text-sm font-medium">
    二人称
    {editingChar.baseCharacterId&&isOverridden(editingChar, 'secondPerson')&&(
     <span className="ml-2 text-xs text-yellow-600">（上書き）</span>
    )}
    </label>
    {isDerived&&(
    <label className="flex items-center gap-1 text-xs text-purple-600"><input
     type="checkbox"
     checked={editingChar.overrides.secondPerson}
     onChange={()=> toggleOverride('secondPerson')}
     className="w-3 h-3"
     /></label>
    )}
   </div><input
    type="text"
    value={editingChar.definition.secondPerson}
    onChange={(e)=> setEditingChar({
    ...editingChar,
    definition: {...editingChar.definition, secondPerson: e.target.value}
    })}
    className="w-full px-3 py-2 border rounded"
    disabled={isDerived&&!editingChar.overrides.secondPerson}
   /></div></div><div><div className="flex items-center justify-between mb-2"><label className="block text-sm font-medium">口癖・決まり文句</label><button
    onClick={()=> {
    const phrases=editingChar.definition.phrases||[];
    setEditingChar({
     ...editingChar,
     definition: {
     ...editingChar.definition,
     phrases: [...phrases, '']
     }
    });
    }}
    className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
   ><Plus size={14} />
    追加
   </button></div>
   {(editingChar.definition.phrases||[]).length===0 ? (
   <p className="text-xs text-gray-500">口癖を追加すると、キャラクターがより個性的になります</p>
   ) : (
   <div className="space-y-2">
    {(editingChar.definition.phrases||[]).map((phrase, index)=> (
    <div key={index} className="flex gap-2"><input
     type="text"
     value={phrase}
     onChange={(e)=> {
      const newCatchphrases=[...editingChar.definition.phrases];
      newCatchphrases[index]=e.target.value;
      setEditingChar({
      ...editingChar,
      definition: {...editingChar.definition, phrases: newCatchphrases}
      });
     }}
     placeholder="例: ～だよね！、～なのだ"
     className="flex-1 px-3 py-2 border rounded text-sm"
     /><button
     onClick={()=> {
      const newCatchphrases=editingChar.definition.phrases.filter((_, i)=> i !==index);
      setEditingChar({
      ...editingChar,
      definition: {...editingChar.definition, phrases: newCatchphrases}
      });
     }}
     className="p-2 text-red-600 hover:bg-red-50 rounded"
     ><Trash2 size={16} /></button></div>
    ))}
   </div>
   )}
  </div><div className={`${editingChar.baseCharacterId&&isOverridden(editingChar, 'custPrompt') ? 'bg-yellow-50 border-yellow-200' : ''} border rounded p-3`}><div className="flex items-center justify-between mb-1"><label className="block text-sm font-medium">
    カスタムシステムプロンプト
    {editingChar.baseCharacterId&&isOverridden(editingChar, 'custPrompt')&&(
    <span className="ml-2 text-xs text-yellow-600">（オーバーライド中）</span>
    )}
   </label>
   {isDerived&&(
    <label className="flex items-center gap-1 text-xs text-purple-600"><input
     type="checkbox"
     checked={editingChar.overrides.custPrompt}
     onChange={()=> toggleOverride('custPrompt')}
     className="w-3 h-3"
    />
    カスタマイズ
    </label>
   )}
   </div><textarea
   value={editingChar.definition.custPrompt||''}
   onChange={(e)=> setEditingChar({
    ...editingChar,
    definition: {...editingChar.definition, custPrompt: e.target.value}
   })}
   placeholder="キャラクターに関する追加の指示や設定を記述できます。&#10;例: このキャラクターは特定の話題には強い意見を持っています。&#10;より詳細なロールプレイ設定や制約を記述できます。"
   className="w-full px-3 py-2 border rounded text-sm min-h-[100px]"
   disabled={isDerived&&!editingChar.overrides.custPrompt}
   /><p className="text-xs text-gray-500 mt-1">
   キャラクター設定に追加したい詳細な指示を自由に記述できます
   </p></div><div><div className="flex items-center justify-between mb-1"><label className="block text-sm font-medium">アバター</label>
   {isDerived&&(
    <label className="flex items-center gap-1 text-xs text-purple-600"><input
     type="checkbox"
     checked={editingChar.overrides.avatar}
     onChange={()=> toggleOverride('avatar')}
     className="w-3 h-3"
    />
    カスタマイズ
    </label>
   )}
   </div><div className="flex gap-2 mb-2"><button
    onClick={()=> setEditingChar({
    ...editingChar,
    features: {...editingChar.features, avType: 'emoji'}
    })}
    className={`flex-1 px-3 py-2 rounded text-sm font-medium transition ${
    editingChar.features.avType==='emoji'
     ? 'bg-indigo-600 text-white'
     : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
    }`}
    disabled={isDerived&&!editingChar.overrides.avatar}
   >
    😊 絵文字
   </button><button
    onClick={()=> setEditingChar({
    ...editingChar,
    features: {...editingChar.features, avType: 'image'}
    })}
    className={`flex-1 px-3 py-2 rounded text-sm font-medium transition ${
    editingChar.features.avType==='image'
     ? 'bg-indigo-600 text-white'
     : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
    }`}
    disabled={isDerived&&!editingChar.overrides.avatar}
   ><Image size={14} className="inline mr-1" />
    画像
   </button></div>
   {editingChar.features.avType==='emoji' ? (
   <div><label className="block text-sm font-medium text-gray-700 mb-2">絵文字</label><div className="flex items-center gap-2"><div className="flex-1 flex items-center justify-center bg-white border-2 border-gray-300 rounded p-4"><span className="text-5xl">{editingChar.features.avatar||'😊'}</span></div><button
     onClick={(e)=> {
     e.preventDefault();
     e.stopPropagation();
     setShowEmojiPicker(true);
     }}
     className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
     disabled={isDerived&&!editingChar.overrides.avatar}
    >
     変更
    </button></div></div>
   ) : (
   <div><label className="block text-sm font-medium text-gray-700 mb-2">画像</label>
    {editingChar.features.avatImg ? (
    <div className="space-y-3"><div className="flex items-center gap-3"><div className="flex-1 flex items-center justify-center bg-white border-2 border-gray-300 rounded p-4"><img
      src={editingChar.features.avatImg}
      alt="avatar"
      className="w-24 h-24 rounded-full object-cover"
      /></div><div className="flex flex-col gap-2"><button
      onClick={(e)=> {
      e.stopPropagation();
      avatarImageInputRef.current?.click();
      }}
      className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 whitespace-nowrap"
      disabled={isDerived&&!editingChar.overrides.avatar}
      >
      変更
      </button><button
      onClick={(e)=> {
      e.stopPropagation();
      setEditingChar({
      ...editingChar,
      features: {...editingChar.features, avatImg: null}
      });
      }}
      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 whitespace-nowrap"
      disabled={isDerived&&!editingChar.overrides.avatar}
      >
      削除
      </button></div></div></div>
    ) : (
    <div
     onDragOver={handleDragOver}
     onDragEnter={handleDragEnter}
     onDragLeave={handleDragLeave}
     onDrop={handleDrop}
     className={`relative border-2 border-dashed rounded p-8 transition ${
     isDragging
      ? 'border-indigo-500 bg-indigo-50'
      : 'border-gray-300 bg-white hover:border-gray-400'
     } ${(isDerived&&!editingChar.overrides.avatar) ? 'opacity-50 pointer-events-none' : ''}`}
    ><div className="flex flex-col items-center justify-center gap-3"><div className="text-4xl">
      {isDragging ? '📥' : '🖼️'}
     </div><div className="text-center"><p className="text-sm font-medium text-gray-700 mb-1">
      {isDragging ? '画像をドロップ' : '画像をドラッグ＆ドロップ'}
      </p><p className="text-xs text-gray-500 mb-3">または</p><button
      onClick={(e)=> {
      e.preventDefault();
      e.stopPropagation();
      avatarImageInputRef.current?.click();
      }}
      className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-medium"
      disabled={isDerived&&!editingChar.overrides.avatar}
      >
      ファイルを選択
      </button></div></div></div>
    )}
    <p className="text-xs text-gray-500 mt-2">
    💡 画像をアップロード後、円形にクロップできます（PNG, JPG, GIF対応）
    </p></div>
   )}
  </div><input
   ref={avatarImageInputRef}
   type="file"
   accept="image}
{showAutoSetupModal&&(
 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"><div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between"><h2 className="text-xl font-bold flex items-center gap-2"><User size={24} className="text-purple-600" />
   AIアシストキャラクター作成
  </h2><button
   onClick={handleCancelAutoSetup}
   className="p-2 hover:bg-gray-100 rounded transition"
  ><X size={20} /></button></div>
  {}
  <div className="flex border-b bg-gray-50"><button
   onClick={()=> {
   setAutoSetupMode('template');
   setGeneratedCharacterPreview(null);
   setGeneratedTemplate(null);
   setGenerationError(null);
   }}
   className={`flex-1 px-6 py-3 font-medium transition ${
   autoSetupMode==='template'
    ? 'text-purple-600 border-b-2 border-purple-600 bg-white'
    : 'text-gray-600 hover:bg-gray-100'
   }`}
  >
   既存キャラクター（テンプレート）
  </button><button
   onClick={()=> {
   setAutoSetupMode('simple');
   setGeneratedCharacterPreview(null);
   setGeneratedTemplate(null);
   setGenerationError(null);
   }}
   className={`flex-1 px-6 py-3 font-medium transition ${
   autoSetupMode==='simple'
    ? 'text-purple-600 border-b-2 border-purple-600 bg-white'
    : 'text-gray-600 hover:bg-gray-100'
   }`}
  >
   オリジナルキャラクター（AI生成）
  </button></div><div className="p-6 space-y-4 overflow-y-auto flex-1">
  {autoSetupMode==='template' ? (
   !generatedTemplate ? (
   <><div className="bg-blue-50 border border-blue-200 rounded p-4"><p className="text-sm text-blue-900"><strong>📋 テンプレート生成:</strong> キャラクター名と作品名を入力すると、WebSearch対応AIで使用するプロンプトとテンプレートを生成します。
     生成されたプロンプトを Claude.ai などのWebSearch対応AIに入力して、正確なキャラクター設定を作成してください。
    </p></div><div><label className="block text-sm font-medium text-gray-700 mb-2">
     キャラクター名 <span className="text-red-500">*</span></label><input
     type="text"
     value={autoSetupCharName}
     onChange={(e)=> setAutoSetupCharName(e.target.value)}
     placeholder="例: 竈門炭治郎、初音ミク、etc..."
     className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    /></div><div><label className="block text-sm font-medium text-gray-700 mb-2">
     作品名（任意）
    </label><input
     type="text"
     value={autoSetupWorkName}
     onChange={(e)=> setAutoSetupWorkName(e.target.value)}
     placeholder="例: 鬼滅の刃、VOCALOID、etc..."
     className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    /></div><div><label className="block text-sm font-medium text-gray-700 mb-2">
     追加情報（任意）
    </label><textarea
     value={autoSetupAdditionalInfo}
     onChange={(e)=> setAutoSetupAdditionalInfo(e.target.value)}
     placeholder="キャラクターの特徴や設定について追加情報があれば入力してください&#10;例: 明るく前向きな性格、剣術が得意、家族思い、etc..."
     className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent h-24 resize-none"
    /></div><div className="flex gap-3 pt-4"><button
     onClick={handleGenerateTemplate}
     disabled={!autoSetupCharName.trim()}
     className="flex-1 px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
    ><FileText size={16} />
     プロンプト&テンプレート生成
    </button><button
     onClick={handleCancelAutoSetup}
     className="px-6 py-3 bg-gray-500 text-white rounded hover:bg-gray-600"
    >
     キャンセル
    </button></div></>
   ) : (
   <><div className="bg-green-50 border border-green-200 rounded p-4"><p className="text-sm text-green-900"><strong>✅ プロンプト生成完了:</strong> 以下のプロンプトをコピーして、Claude.ai などのWebSearch対応AIに入力してください。
    </p></div><div><div className="flex items-center justify-between mb-2"><label className="block text-sm font-medium text-gray-700">プロンプト</label><button
     onClick={()=> handleCopyTemplate(generatedTemplate.prompt)}
     className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
     ><Copy size={14} />
     コピー
     </button></div><textarea
     value={generatedTemplate.prompt}
     readOnly
     className="w-full px-4 py-2 border rounded bg-gray-50 h-48 text-sm font-mono"
    /></div><div><div className="flex items-center justify-between mb-2"><label className="block text-sm font-medium text-gray-700">テンプレートJSON</label><div className="flex gap-2"><button
      onClick={()=> handleCopyTemplate(generatedTemplate.jsonTemplate)}
      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
     ><Copy size={14} />
      コピー
     </button><button
      onClick={handleDownloadTemplate}
      className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
     ><Download size={14} />
      ダウンロード
     </button></div></div><textarea
     value={generatedTemplate.jsonTemplate}
     readOnly
     className="w-full px-4 py-2 border rounded bg-gray-50 h-48 text-sm font-mono"
    /><p className="text-xs text-gray-500 mt-1">
     ファイル名: {generatedTemplate.fileName}
    </p></div><div className="border-t pt-4"><h3 className="font-medium text-gray-900 mb-3">📝 次の手順:</h3><ol className="list-decimal list-inside space-y-2 text-sm text-gray-700"><li>上記のプロンプトを <strong>コピー</strong> してください</li><li><strong>Claude.ai</strong> を新しいタブで開く（WebSearch機能が利用可能）</li><li>新しいチャットでプロンプトを貼り付けて送信</li><li>AIが生成したJSON形式の設定をコピー</li><li>このアプリの「<strong>インポート</strong>」機能でJSONを読み込む</li></ol><div className="mt-3 text-xs text-gray-600 bg-blue-50 p-2 rounded">
     💡 <strong>ヒント:</strong> テンプレートJSONをダウンロードして手動編集してからインポートすることもできます
    </div></div><div className="flex gap-3 pt-4"><button
     onClick={()=> setGeneratedTemplate(null)}
     className="flex-1 px-6 py-3 bg-gray-500 text-white rounded hover:bg-gray-600"
    >
     やり直す
    </button><button
     onClick={handleCancelAutoSetup}
     className="px-6 py-3 bg-indigo-600 text-white rounded hover:bg-indigo-700"
    >
     完了
    </button></div></>
   )
  ) : (
   !genCharPrev ? (
   <><div className="bg-purple-50 border border-purple-200 rounded p-4"><p className="text-sm text-purple-900"><strong>✨ AI生成:</strong> 簡単な説明を入力すると、AIが詳細なキャラクター設定を自動生成します。
     オリジナルキャラクターの作成に最適です。
    </p></div><div><label className="block text-sm font-medium text-gray-700 mb-2">
     キャラクターの説明 <span className="text-red-500">*</span></label><textarea
     value={simpleDescription}
     onChange={(e)=> setSimpleDescription(e.target.value)}
     placeholder="例: 明るくて元気な女子高生、料理が得意で家族思い。いつも笑顔で周りを元気にする。&#10;&#10;例: クールで無口な剣士、黒髪に青い瞳。実は優しい性格で仲間思い。"
     className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent h-40 resize-none"
     disabled={isGeneratingCharacter}
    /><p className="text-xs text-gray-500 mt-1">
     性格、外見、特技、背景などを自由に記述してください
    </p></div>
    {genErr&&(
    <div className="bg-red-50 border border-red-200 rounded p-4"><p className="text-sm text-red-900"><strong>エラー:</strong> {genErr}
     </p></div>
    )}
    <div className="flex gap-3 pt-4"><button
     onClick={handleGenerateFromSimple}
     disabled={isGeneratingCharacter||!simpleDescription.trim()}
     className="flex-1 px-6 py-3 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
    >
     {isGeneratingCharacter ? (
     <><RefreshCw size={16} className="animate-spin" />
      生成中...
     </>
     ) : (
     <><User size={16} />
      キャラクター設定を生成
     </>
     )}
    </button><button
     onClick={handleCancelAutoSetup}
     disabled={isGeneratingCharacter}
     className="px-6 py-3 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300"
    >
     キャンセル
    </button></div></>
   ) : (
   <><div className="bg-green-50 border border-green-200 rounded p-4"><p className="text-sm text-green-900"><strong>✅ 生成完了:</strong> キャラクター設定が生成されました。内容を確認して、必要に応じて編集画面で調整してください。
    </p></div><div className="space-y-3 border rounded p-4 bg-gray-50"><div><label className="block text-sm font-medium text-gray-700 mb-1">名前</label><p className="text-base font-semibold">{genCharPrev.name}</p></div><div><label className="block text-sm font-medium text-gray-700 mb-1">性格</label><p className="text-sm text-gray-800">{genCharPrev.pers}</p></div><div><label className="block text-sm font-medium text-gray-700 mb-1">話し方</label><p className="text-sm text-gray-800">{genCharPrev.speakingStyle}</p></div><div className="grid grid-cols-2 gap-3"><div><label className="block text-sm font-medium text-gray-700 mb-1">一人称</label><p className="text-sm text-gray-800">{genCharPrev.firstPerson}</p></div><div><label className="block text-sm font-medium text-gray-700 mb-1">二人称</label><p className="text-sm text-gray-800">{genCharPrev.secondPerson}</p></div></div><div><label className="block text-sm font-medium text-gray-700 mb-1">背景</label><p className="text-sm text-gray-800">{genCharPrev.background}</p></div>
    {genCharPrev.phrases&&genCharPrev.phrases.length > 0&&(
     <div><label className="block text-sm font-medium text-gray-700 mb-1">決め台詞</label><ul className="list-disc list-inside space-y-1">
      {genCharPrev.phrases.map((phrase, idx)=> (
      <li key={idx} className="text-sm text-gray-800">{phrase}</li>
      ))}
     </ul></div>
    )}
    {genCharPrev.custPrompt&&(
     <div><label className="block text-sm font-medium text-gray-700 mb-1">詳細設定（カスタムプロンプト）</label><div className="text-xs text-gray-800 bg-white p-3 rounded border whitespace-pre-wrap max-h-64 overflow-y-auto">
      {genCharPrev.custPrompt}
     </div></div>
    )}
    </div><div className="flex gap-3 pt-4"><button
     onClick={hApplyGen}
     className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center justify-center gap-2 font-medium"
    ><Check size={16} />
     この設定で作成
    </button><button
     onClick={()=> {
     setGeneratedCharacterPreview(null);
     setGenerationError(null);
     }}
     className="px-6 py-3 bg-gray-500 text-white rounded hover:bg-gray-600"
    >
     やり直す
    </button></div></>
   )
  )}
  </div></div></div>
)}
</div>
);
});
export default MultiCharacterChat;