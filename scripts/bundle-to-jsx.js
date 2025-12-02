#!/usr/bin/env node

/**
 * TypeScript Bundle to JSX Converter
 *
 * Converts TypeScript source files in src/ to a single JSX file
 * suitable for Claude Artifacts format.
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = 'Multi character chat.jsx';
const SRC_DIR = 'src';

console.log('🔧 Starting TypeScript to JSX bundle process...\n');

// File reading order
const fileOrder = [
  // Constants first
  'src/constants/index.ts',
  // Utils
  'src/lib/utils.ts',
  'src/lib/helpers.ts',
  'src/lib/indexedDB.ts',
  // Hooks
  'src/hooks/useCharacterManager.ts',
  'src/hooks/useConversationManager.ts',
  'src/hooks/useMessageManager.ts',
  'src/hooks/useStorage.ts',
  'src/hooks/useClaudeAPI.ts',
  // Components (order matters for dependencies)
  'src/components/EmojiPicker.tsx',
  'src/components/ImageCropper.tsx',
  'src/components/AvatarDisplay.tsx',
  'src/components/ConfirmDialog.tsx',
  'src/components/MessageBubble.tsx',
  'src/components/ConversationCard.tsx',
  'src/components/ConversationSettings.tsx',
  'src/components/CharacterModal.tsx',
  // Main App last
  'src/App.tsx',
];

/**
 * Remove TypeScript type annotations
 */
function removeTypeAnnotations(code) {
  // Remove interface declarations
  code = code.replace(/^export\s+interface\s+\w+\s*{[^}]*}/gms, '');
  code = code.replace(/^interface\s+\w+\s*{[^}]*}/gms, '');

  // Remove type declarations
  code = code.replace(/^export\s+type\s+\w+\s*=\s*[^;]+;/gm, '');
  code = code.replace(/^type\s+\w+\s*=\s*[^;]+;/gm, '');

  // Remove import type statements
  code = code.replace(/^import\s+type\s+{[^}]+}\s+from\s+['"][^'"]+['"];?\s*$/gm, '');

  // Remove type annotations from function parameters and variables
  code = code.replace(/:\s*\w+(\[\])?(\s*\|[^,);=]+)*(?=[,);=\s])/g, '');

  // Remove generic type parameters (more aggressive)
  code = code.replace(/:\s*Array<[^>]+>/g, '');

  // Remove generic type parameters but preserve JSX
  // Only remove if it looks like a type parameter (contains specific type keywords or patterns)
  code = code.replace(/<(\w+)(?:\s*&\s*{[^}]*})?>/g, (match, name) => {
    // Preserve JSX tags (start with capital letter or common HTML tags)
    const htmlTags = ['div', 'span', 'button', 'input', 'select', 'option', 'textarea', 'label', 'form', 'a', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'img', 'svg', 'path', 'header', 'footer', 'nav', 'section', 'article', 'aside', 'main'];
    if (name[0] === name[0].toUpperCase() || htmlTags.includes(name.toLowerCase())) {
      return match;
    }
    // Remove type parameters
    return '';
  });

  // Remove 'as' type assertions
  code = code.replace(/\s+as\s+\w+/g, '');
  code = code.replace(/\s+as\s+unknown\s+as\s+\w+/g, '');

  // Remove & type intersections
  code = code.replace(/\s+&\s+{\s*[^}]*}/g, '');

  // Remove React.FC and similar type annotations
  code = code.replace(/:\s*React\.FC\s*/g, ' ');
  code = code.replace(/:\s*FC\s*/g, ' ');

  return code;
}

/**
 * Remove import statements (except React and lucide-react)
 */
function removeLocalImports(code) {
  // Remove local imports (starting with ./ or ../)
  code = code.replace(/^import\s+{[^}]+}\s+from\s+['"]\.{1,2}\/[^'"]+['"];?\s*$/gm, '');
  code = code.replace(/^import\s+\w+\s+from\s+['"]\.{1,2}\/[^'"]+['"];?\s*$/gm, '');
  code = code.replace(/^import\s+\*\s+as\s+\w+\s+from\s+['"]\.{1,2}\/[^'"]+['"];?\s*$/gm, '');

  return code;
}

/**
 * Remove export keywords (but keep export default)
 */
function removeExports(code) {
  code = code.replace(/^export\s+const\s+/gm, 'const ');
  code = code.replace(/^export\s+function\s+/gm, 'function ');
  // Keep 'export default' as is, don't remove it

  return code;
}

/**
 * Clean up extra whitespace
 */
function cleanWhitespace(code) {
  // Remove multiple consecutive blank lines
  code = code.replace(/\n\s*\n\s*\n/g, '\n\n');

  // Remove trailing whitespace
  code = code.replace(/[ \t]+$/gm, '');

  return code;
}

/**
 * Process a single file
 */
function processFile(filePath) {
  console.log(`  Processing: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠️  File not found: ${filePath}`);
    return '';
  }

  let code = fs.readFileSync(filePath, 'utf8');

  // Remove comments at the top (usually just file descriptions)
  code = code.replace(/^\/\*\*[\s\S]*?\*\/\s*/m, '');

  // Apply transformations
  code = removeTypeAnnotations(code);
  code = removeLocalImports(code);
  code = removeExports(code);
  code = cleanWhitespace(code);

  return code;
}

/**
 * Collect all React and lucide-react imports
 */
function collectImports() {
  const reactImports = new Set(['useState', 'useEffect', 'useCallback', 'useMemo', 'useRef']);
  const lucideImports = new Set();

  fileOrder.forEach(filePath => {
    if (!fs.existsSync(filePath)) return;

    const code = fs.readFileSync(filePath, 'utf8');

    // Collect React imports
    const reactMatch = code.match(/import\s+(?:React,\s*)?{([^}]+)}\s+from\s+['"]react['"]/);
    if (reactMatch) {
      reactMatch[1].split(',').forEach(imp => {
        reactImports.add(imp.trim());
      });
    }

    // Collect lucide-react imports
    const lucideMatch = code.match(/import\s+{([^}]+)}\s+from\s+['"]lucide-react['"]/);
    if (lucideMatch) {
      lucideMatch[1].split(',').forEach(imp => {
        lucideImports.add(imp.trim());
      });
    }
  });

  return {
    react: Array.from(reactImports).filter(x => x.trim()).sort(),
    lucide: Array.from(lucideImports).filter(x => x.trim()).sort(),
  };
}

/**
 * Generate bundle header
 */
function generateHeader(imports) {
  const now = new Date().toISOString();

  return `/**
 * Multi Character Chat Application
 *
 * Bundled from TypeScript source files
 * Bundle Date: ${now}
 * Source: src/ directory
 */

import React, { ${imports.react.join(', ')} } from 'react';
import { ${imports.lucide.join(', ')} } from 'lucide-react';
`;
}

/**
 * Main bundle function
 */
function generateBundle() {
  console.log('\n📦 Collecting imports...');
  const imports = collectImports();

  console.log(`  React imports: ${imports.react.length} items`);
  console.log(`  Lucide imports: ${imports.lucide.length} items`);

  console.log('\n📄 Processing source files...\n');

  let bundle = generateHeader(imports);

  // Process constants and utils
  bundle += '\n// ========================================\n';
  bundle += '// Constants & Utilities\n';
  bundle += '// ========================================\n\n';

  ['src/constants/index.ts', 'src/lib/utils.ts', 'src/lib/helpers.ts', 'src/lib/indexedDB.ts'].forEach(file => {
    const code = processFile(file);
    if (code.trim()) {
      bundle += code + '\n\n';
    }
  });

  // Process hooks
  bundle += '// ========================================\n';
  bundle += '// Custom Hooks\n';
  bundle += '// ========================================\n\n';

  [
    'src/hooks/useCharacterManager.ts',
    'src/hooks/useConversationManager.ts',
    'src/hooks/useMessageManager.ts',
    'src/hooks/useStorage.ts',
    'src/hooks/useClaudeAPI.ts',
  ].forEach(file => {
    const code = processFile(file);
    if (code.trim()) {
      bundle += code + '\n\n';
    }
  });

  // Process components
  bundle += '// ========================================\n';
  bundle += '// UI Components\n';
  bundle += '// ========================================\n\n';

  [
    'src/components/EmojiPicker.tsx',
    'src/components/ImageCropper.tsx',
    'src/components/AvatarDisplay.tsx',
    'src/components/ConfirmDialog.tsx',
    'src/components/MessageBubble.tsx',
    'src/components/ConversationCard.tsx',
    'src/components/ConversationSettings.tsx',
    'src/components/CharacterModal.tsx',
  ].forEach(file => {
    const code = processFile(file);
    if (code.trim()) {
      bundle += code + '\n\n';
    }
  });

  // Process main App
  bundle += '// ========================================\n';
  bundle += '// Main Application Component\n';
  bundle += '// ========================================\n\n';

  const appCode = processFile('src/App.tsx');
  bundle += appCode + '\n';

  // Final cleanup
  bundle = cleanWhitespace(bundle);

  return bundle;
}

// Main execution
try {
  const bundle = generateBundle();

  console.log(`\n✍️  Writing bundle to ${OUTPUT_FILE}...`);
  fs.writeFileSync(OUTPUT_FILE, bundle, 'utf8');

  const stats = fs.statSync(OUTPUT_FILE);
  const sizeKB = (stats.size / 1024).toFixed(2);

  console.log(`\n✅ Bundle created successfully!`);
  console.log(`   File: ${OUTPUT_FILE}`);
  console.log(`   Size: ${sizeKB} KB`);
  console.log(`\n🎉 Done!\n`);

} catch (error) {
  console.error('\n❌ Error creating bundle:', error.message);
  process.exit(1);
}
