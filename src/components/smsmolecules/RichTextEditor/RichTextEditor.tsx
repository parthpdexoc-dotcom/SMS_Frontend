import { SMSIcon } from '@/components/smsatoms';
import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { EMAIL_TEMPLATES } from '@/constants/strings';
import { ColorPicker, PRESET_COLORS } from './ColorPicker';
import './RichTextEditor.css';

export interface SecondaryEditorConfig {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  minHeight?: string | number;
  id?: string;
}

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  minHeight?: string | number;
  className?: string;
  /** Keywords to insert at cursor; inserted as `[Keyword]` (or unchanged if already `[…]`). */
  keywords?: string[];
  /** When true, show Keyword toolbar/context UI even if keywords is empty (e.g. email templates). */
  alwaysShowKeywordDropdown?: boolean;
  /** When true, Keyword controls stay visible but cannot insert (e.g. no email type selected). */
  keywordDropdownDisabled?: boolean;
  /** Optional secondary editor sharing the same toolbar (e.g. SMS Body). */
  secondaryEditor?: SecondaryEditorConfig;
}

const DEFAULT_TEXT_COLOR = '#000000';
const DEFAULT_HIGHLIGHT_COLOR = '#000000';

const FONT_SIZES = [
  { value: '10px', label: '10' }, { value: '12px', label: '12' }, { value: '14px', label: '14' },
  { value: '16px', label: '16' }, { value: '18px', label: '18' }, { value: '20px', label: '20' },
  { value: '24px', label: '24' }, { value: '28px', label: '28' }, { value: '32px', label: '32' },
];

const INITIAL_FORMAT_STATE = {
  bold: false,
  italic: false,
  underline: false,
  textColor: null as string | null,
  highlightColor: null as string | null,
  fontSize: null as string | null,
};

type FormatState = typeof INITIAL_FORMAT_STATE;

const FORMAT_BUTTONS: Array<{ command: string; icon: 'format_bold' | 'format_italic' | 'format_underlined'; label: string; key: keyof Pick<FormatState, 'bold' | 'italic' | 'underline'> }> = [
  { command: 'bold', icon: 'format_bold', label: 'Bold', key: 'bold' },
  { command: 'italic', icon: 'format_italic', label: 'Italic', key: 'italic' },
  { command: 'underline', icon: 'format_underlined', label: 'Underline', key: 'underline' },
];

/** Append --active modifier when condition is true. */
function withActive(base: string, active: boolean): string {
  return active ? `${base} ${base}--active` : base;
}

function filterKeywordsByQuery(keywords: string[], query: string): string[] {
  if (!query.trim()) return keywords;
  const q = query.toLowerCase();
  return keywords.filter((kw) => {
    const afterBracket = kw.startsWith('[') ? kw.slice(1) : kw;
    return afterBracket.toLowerCase().includes(q);
  });
}

/** Inserted text is always a single placeholder `[Name]`; core is stripped of optional outer []. */
function toBracketedPlaceholder(keyword: string): string {
  const t = keyword.trim();
  if (!t) return '';
  if (t.startsWith('[') && t.endsWith(']')) return t;
  return `[${t}]`;
}

/** Convert computed color (e.g. "rgb(0,0,0)" or "#000") to hex. */
function computedColorToHex(computed: string): string {
  if (!computed || computed === 'transparent') return '#000000';
  if (computed.startsWith('#')) return computed.slice(0, 7);
  const m = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return '#000000';
  const r = parseInt(m[1], 10);
  const g = parseInt(m[2], 10);
  const b = parseInt(m[3], 10);
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

const FORMAT_COMMANDS = new Set(['bold', 'italic', 'underline']);

/**
 * If the current selection is inside a placeholder [Keyword], expand the selection to include the brackets
 * so that formatting (e.g. bold) wraps <b>[Keyword]</b> instead of [<b>Keyword</b>].
 */
function expandSelectionToIncludePlaceholder(editor: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return;

  const startRange = document.createRange();
  startRange.setStart(editor, 0);
  startRange.setEnd(range.startContainer, range.startOffset);
  const startOffset = startRange.toString().length;
  const endRange = document.createRange();
  endRange.setStart(editor, 0);
  endRange.setEnd(range.endContainer, range.endOffset);
  const endOffset = endRange.toString().length;

  const fullText = editor.textContent || '';
  const openIdx = fullText.lastIndexOf('[', startOffset);
  const closeIdx = fullText.indexOf(']', endOffset);
  if (openIdx === -1 || closeIdx === -1 || openIdx >= closeIdx) return;
  if (fullText.slice(openIdx + 1, closeIdx).includes('[')) return;

  const getNodeOffset = (charIndex: number): { node: Node; offset: number } => {
    let index = 0;
    const walk = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
    let node: Node | null;
    while ((node = walk.nextNode())) {
      const len = (node.textContent || '').length;
      if (index + len > charIndex) return { node, offset: charIndex - index };
      index += len;
    }
    return { node: editor, offset: 0 };
  };

  const start = getNodeOffset(openIdx);
  const end = getNodeOffset(closeIdx + 1);
  const newRange = document.createRange();
  newRange.setStart(start.node, start.offset);
  newRange.setEnd(end.node, end.offset);
  sel.removeAllRanges();
  sel.addRange(newRange);
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Enter text...',
  label,
  error,
  disabled = false,
  minHeight = '200px',
  className = '',
  keywords = EMAIL_TEMPLATES.DEFAULT_KEYWORDS,
  alwaysShowKeywordDropdown = false,
  keywordDropdownDisabled = false,
  secondaryEditor,
}) => {
  const showKeywordSection = keywords.length > 0 || alwaysShowKeywordDropdown;
  const keywordTriggersDisabled = disabled || keywordDropdownDisabled;
  const editorRef = useRef<HTMLDivElement>(null);
  const secondaryEditorRef = useRef<HTMLDivElement>(null);
  const activeEditorRef = useRef<'primary' | 'secondary'>('primary');

  const getActiveEl = useCallback(() => {
    if (activeEditorRef.current === 'secondary') {
      return secondaryEditorRef.current ?? editorRef.current;
    }
    return editorRef.current ?? secondaryEditorRef.current;
  }, []);

  const isInternalChange = useRef(false);
  const savedSelectionRef = useRef<Range | null>(null);
  const [textColor, setTextColor] = useState(DEFAULT_TEXT_COLOR);
  const [highlightColor, setHighlightColor] = useState(DEFAULT_HIGHLIGHT_COLOR);
  const [openPicker, setOpenPicker] = useState<'text' | 'highlight' | null>(null);
  const [openToolbarDropdown, setOpenToolbarDropdown] = useState<'fontSize' | 'keyword' | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [contextSubmenu, setContextSubmenu] = useState<'fontSize' | 'textColor' | 'highlight' | 'keyword' | null>(null);
  const textPickerRef = useRef<HTMLDivElement>(null);
  const highlightPickerRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const fontSizeDropdownRef = useRef<HTMLDivElement>(null);
  const keywordDropdownRef = useRef<HTMLDivElement>(null);
  const [keywordSuggestPos, setKeywordSuggestPos] = useState<{ x: number; y: number } | null>(null);
  const [keywordSuggestQuery, setKeywordSuggestQuery] = useState('');
  const [keywordSuggestHighlightIndex, setKeywordSuggestHighlightIndex] = useState(0);
  const keywordSuggestRef = useRef<HTMLDivElement>(null);
  const keywordReplaceRangeRef = useRef<Range | null>(null);
  const [keywordDropdownSearchQuery, setKeywordDropdownSearchQuery] = useState('');
  const [formatState, setFormatState] = useState<FormatState>(INITIAL_FORMAT_STATE);

  const filteredKeywordDropdownList = useMemo(
    () => filterKeywordsByQuery(keywords, keywordDropdownSearchQuery),
    [keywords, keywordDropdownSearchQuery]
  );

  const closeKeywordSuggest = useCallback(() => {
    setKeywordSuggestPos(null);
    setKeywordSuggestQuery('');
    setKeywordSuggestHighlightIndex(0);
    keywordReplaceRangeRef.current = null;
  }, []);

  useEffect(() => {
    if (!keywordDropdownDisabled) return;
    if (openToolbarDropdown === 'keyword') {
      setOpenToolbarDropdown(null);
      setKeywordDropdownSearchQuery('');
    }
    if (contextSubmenu === 'keyword') {
      setContextSubmenu(null);
      setKeywordDropdownSearchQuery('');
    }
    closeKeywordSuggest();
  }, [keywordDropdownDisabled, openToolbarDropdown, contextSubmenu, closeKeywordSuggest]);

  const updateFormatState = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      return;
    }
    const range = sel.getRangeAt(0);
    const prim = editorRef.current;
    const sec = secondaryEditorRef.current;
    let el: HTMLDivElement | null = null;
    if (sec && sec.contains(range.commonAncestorContainer)) {
      activeEditorRef.current = 'secondary';
      el = sec;
    } else if (prim && prim.contains(range.commonAncestorContainer)) {
      activeEditorRef.current = 'primary';
      el = prim;
    } else {
      el = getActiveEl();
    }
    if (!el) return;
    let textColor: string | null = null;
    let highlightColor: string | null = null;
    let fontSize: string | null = null;
    const node = range.startContainer;
    const elem = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    if (elem && el.contains(elem)) {
      const style = window.getComputedStyle(elem);
      textColor = computedColorToHex(style.color);
      const bg = style.backgroundColor;
      if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
        highlightColor = computedColorToHex(bg);
      }
      const fs = style.fontSize;
      if (fs) fontSize = fs;
    }
    setFormatState({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      textColor,
      highlightColor,
      fontSize,
    });
  }, [getActiveEl]);

  useEffect(() => {
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const prim = editorRef.current;
      const sec = secondaryEditorRef.current;
      if (
        (prim && prim.contains(range.commonAncestorContainer)) ||
        (sec && sec.contains(range.commonAncestorContainer))
      ) {
        updateFormatState();
      }
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [updateFormatState]);

  useEffect(() => {
    const hasOpen = openPicker !== null || openToolbarDropdown !== null || contextMenu !== null || keywordSuggestPos !== null;
    if (!hasOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (openPicker === 'text' && textPickerRef.current && !textPickerRef.current.contains(target)) setOpenPicker(null);
      if (openPicker === 'highlight' && highlightPickerRef.current && !highlightPickerRef.current.contains(target)) setOpenPicker(null);
      if (openToolbarDropdown !== null) {
        const ref = openToolbarDropdown === 'fontSize' ? fontSizeDropdownRef.current : keywordDropdownRef.current;
        if (ref && !ref.contains(target)) setOpenToolbarDropdown(null);
      }
      if (contextMenu !== null && contextMenuRef.current && !contextMenuRef.current.contains(target)) {
        setContextMenu(null);
        setContextSubmenu(null);
      }
      if (
        keywordSuggestPos !== null &&
        keywordSuggestRef.current &&
        !keywordSuggestRef.current.contains(target) &&
        !editorRef.current?.contains(target) &&
        !secondaryEditorRef.current?.contains(target)
      ) {
        closeKeywordSuggest();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openPicker, openToolbarDropdown, contextMenu, keywordSuggestPos, closeKeywordSuggest]);

  useEffect(() => {
    if (!keywordSuggestPos) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeKeywordSuggest();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [keywordSuggestPos, closeKeywordSuggest]);

  const filteredKeywordSuggestions = useMemo(
    () => filterKeywordsByQuery(keywords, keywordSuggestQuery),
    [keywords, keywordSuggestQuery]
  );

  const effectiveTextColor = formatState.textColor ?? textColor;
  const effectiveHighlightColor = formatState.highlightColor ?? highlightColor;
  const fontSizeLabel = formatState.fontSize ? formatState.fontSize.replace(/^(\d+)px$/, '$1') : 'Size';

  useEffect(() => {
    if (!keywordSuggestPos || filteredKeywordSuggestions.length === 0) return;
    const len = filteredKeywordSuggestions.length;
    const clampedIdx = Math.min(keywordSuggestHighlightIndex, len - 1);
    setKeywordSuggestHighlightIndex((i) => Math.min(i, len - 1));
    const listEl = keywordSuggestRef.current;
    if (listEl) {
      const option = listEl.querySelector(`[data-keyword-option-index="${clampedIdx}"]`);
      if (option) (option as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }, [keywordSuggestPos, keywordSuggestHighlightIndex, filteredKeywordSuggestions.length]);

  /** Returns text from start of editor to current cursor, or null if unavailable. */
  const getTextBeforeCursor = useCallback((target?: 'primary' | 'secondary'): string | null => {
    const which = target ?? activeEditorRef.current;
    const el = which === 'secondary' ? secondaryEditorRef.current : editorRef.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0).cloneRange();
    if (!el.contains(range.commonAncestorContainer)) return null;
    try {
      const startRange = document.createRange();
      startRange.selectNodeContents(el);
      startRange.collapse(true);
      range.setStart(startRange.startContainer, startRange.startOffset);
      return range.toString();
    } catch {
      return null;
    }
  }, []);

  const getKeywordSuggestQuery = useCallback((target?: 'primary' | 'secondary'): string | null => {
    const text = getTextBeforeCursor(target);
    if (text === null) return null;
    const idx = text.lastIndexOf('[');
    if (idx === -1) return null;
    return text.slice(idx + 1);
  }, [getTextBeforeCursor]);

  const saveKeywordReplaceRange = useCallback(() => {
    const sel = window.getSelection();
    const saved = savedSelectionRef.current;
    if (!sel || sel.rangeCount === 0 || !saved) return;
    try {
      const current = sel.getRangeAt(0).cloneRange();
      const replaceRange = document.createRange();
      replaceRange.setStart(saved.startContainer, Math.max(0, saved.startOffset - 1));
      replaceRange.setEnd(current.endContainer, current.endOffset);
      keywordReplaceRangeRef.current = replaceRange;
    } catch {
      keywordReplaceRangeRef.current = null;
    }
  }, []);

  const handleInput = useCallback((target?: 'primary' | 'secondary') => {
    const which = target ?? activeEditorRef.current;
    const el = which === 'secondary' ? secondaryEditorRef.current : editorRef.current;
    if (!el) return;
    if (keywordSuggestPos !== null) {
      const textBefore = getTextBeforeCursor(which);
      if (textBefore === null || !textBefore.includes('[')) {
        closeKeywordSuggest();
      } else {
        setKeywordSuggestQuery(getKeywordSuggestQuery(which) ?? '');
        saveKeywordReplaceRange();
      }
    }
    isInternalChange.current = true;
    const rawHtml = el.innerHTML;
    const isEffectivelyEmpty =
      !el.textContent?.trim() &&
      (el.children.length === 0 || (el.children.length === 1 && el.children[0].tagName === 'BR'));
    const valueToEmit = isEffectivelyEmpty ? '' : rawHtml;
    if (isEffectivelyEmpty && rawHtml !== '') {
      el.innerHTML = '';
    }

    if (which === 'secondary') {
      secondaryEditor?.onChange(valueToEmit);
    } else {
      onChange(valueToEmit);
    }
    isInternalChange.current = false;
  }, [
    onChange,
    secondaryEditor,
    keywordSuggestPos,
    getTextBeforeCursor,
    getKeywordSuggestQuery,
    closeKeywordSuggest,
    saveKeywordReplaceRange,
  ]);

  const handleEditorBlurWithInput = useCallback((target?: 'primary' | 'secondary') => {
    handleInput(target);
  }, [handleInput]);

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const prim = editorRef.current;
    const sec = secondaryEditorRef.current;
    if (sec && sec.contains(range.commonAncestorContainer)) {
      activeEditorRef.current = 'secondary';
      savedSelectionRef.current = range.cloneRange();
    } else if (prim && prim.contains(range.commonAncestorContainer)) {
      activeEditorRef.current = 'primary';
      savedSelectionRef.current = range.cloneRange();
    }
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, target: 'primary' | 'secondary' = 'primary') => {
      activeEditorRef.current = target;
      const isTargetDisabled = disabled || (target === 'secondary' && secondaryEditor?.disabled);
      if (isTargetDisabled) return;
      e.preventDefault();
      saveSelection();
      setContextMenu({ x: e.clientX, y: e.clientY });
      setContextSubmenu(null);
    },
    [disabled, secondaryEditor?.disabled, saveSelection]
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
    setContextSubmenu(null);
  }, []);

  const setContextSubmenuKey = useCallback((key: typeof contextSubmenu) => {
    setContextSubmenu(key);
  }, []);

  const clearContextSubmenuIf = useCallback((key: typeof contextSubmenu) => {
    setContextSubmenu((s) => (s === key ? null : s));
  }, []);

  const handleMouseUp = useCallback(
    (e: React.MouseEvent, target: 'primary' | 'secondary' = 'primary') => {
      activeEditorRef.current = target;
      const isTargetDisabled = disabled || (target === 'secondary' && secondaryEditor?.disabled);
      if (isTargetDisabled) return;
      const el = target === 'secondary' ? secondaryEditorRef.current : editorRef.current;
      const sel = window.getSelection();
      if (!el || !sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (range.collapsed || !el.contains(range.commonAncestorContainer)) return;
      saveSelection();
      setContextMenu({ x: e.clientX, y: e.clientY });
      setContextSubmenu(null);
    },
    [disabled, secondaryEditor?.disabled, saveSelection]
  );

  const restoreSelectionAndExec = useCallback(
    (command: string, value: string) => {
      const el = getActiveEl();
      if (!el) return;
      el.focus();
      const sel = window.getSelection();
      if (sel && savedSelectionRef.current) {
        sel.removeAllRanges();
        sel.addRange(savedSelectionRef.current);
        savedSelectionRef.current = null;
      }
      if (FORMAT_COMMANDS.has(command)) {
        expandSelectionToIncludePlaceholder(el);
      }
      document.execCommand(command, false, value);
      handleInput(activeEditorRef.current);
      requestAnimationFrame(updateFormatState);
    },
    [getActiveEl, handleInput, updateFormatState]
  );

  const syncValueToEditor = useCallback(() => {
    if (isInternalChange.current) return;
    const prim = editorRef.current;
    if (prim && prim.innerHTML !== (value || '')) {
      prim.innerHTML = value || '';
    }
    const sec = secondaryEditorRef.current;
    if (sec && secondaryEditor && sec.innerHTML !== (secondaryEditor.value || '')) {
      sec.innerHTML = secondaryEditor.value || '';
    }
  }, [value, secondaryEditor]);

  useEffect(() => {
    syncValueToEditor();
  }, [syncValueToEditor, value, secondaryEditor?.value]);

  const exec = useCallback(
    (command: string, value?: string) => {
      const el = getActiveEl();
      if (!el) return;
      el.focus();
      const sel = window.getSelection();
      if (sel && savedSelectionRef.current) {
        sel.removeAllRanges();
        sel.addRange(savedSelectionRef.current);
        savedSelectionRef.current = null;
      }
      if (FORMAT_COMMANDS.has(command)) {
        expandSelectionToIncludePlaceholder(el);
      }
      document.execCommand(command, false, value ?? undefined);
      handleInput(activeEditorRef.current);
      requestAnimationFrame(updateFormatState);
    },
    [getActiveEl, handleInput, updateFormatState]
  );

  const applyFontSize = useCallback(
    (fontSize: string) => {
      const el = getActiveEl();
      if (!el || !fontSize) return;
      el.focus();
      const sel = window.getSelection();
      if (!sel || !savedSelectionRef.current) return;
      sel.removeAllRanges();
      sel.addRange(savedSelectionRef.current);
      savedSelectionRef.current = null;
      try {
        const range = sel.getRangeAt(0);
        const span = document.createElement('span');
        span.style.fontSize = fontSize;
        const fragment = range.extractContents();
        span.appendChild(fragment);
        // Normalize descendant font sizes so line height is driven by this span only
        span.querySelectorAll('[style*="font-size"]').forEach((node) => {
          (node as HTMLElement).style.fontSize = fontSize;
        });
        range.insertNode(span);
        sel.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        sel.addRange(newRange);
      } catch {
        // fallback: execCommand fontSize (uses legacy 1-7 scale)
        const legacySize = Math.min(7, Math.max(1, Math.round(parseInt(fontSize, 10) / 4)));
        document.execCommand('fontSize', false, String(legacySize));
      }
      handleInput(activeEditorRef.current);
      requestAnimationFrame(updateFormatState);
    },
    [getActiveEl, handleInput, updateFormatState]
  );

  /** When the keyword suggest is open, select from "[" to current cursor so insertKeyword replaces "[query". */
  const selectKeywordSuggestRange = useCallback(() => {
    const sel = window.getSelection();
    const el = getActiveEl();
    if (!el || !sel) return;
    const savedReplace = keywordReplaceRangeRef.current;
    if (savedReplace) {
      try {
        sel.removeAllRanges();
        sel.addRange(savedReplace.cloneRange());
      } catch {
        // ignore
      }
      keywordReplaceRangeRef.current = null;
      savedSelectionRef.current = null;
      return;
    }
    const saved = savedSelectionRef.current;
    if (!saved || sel.rangeCount === 0) return;
    try {
      const current = sel.getRangeAt(0).cloneRange();
      const replaceRange = document.createRange();
      replaceRange.setStart(saved.startContainer, Math.max(0, saved.startOffset - 1));
      replaceRange.setEnd(current.endContainer, current.endOffset);
      sel.removeAllRanges();
      sel.addRange(replaceRange);
      savedSelectionRef.current = null;
    } catch {
      savedSelectionRef.current = null;
    }
  }, [getActiveEl]);

  const insertKeyword = useCallback(
    (keyword: string) => {
      const el = getActiveEl();
      if (!el || !keyword) return;
      const toInsert = toBracketedPlaceholder(keyword);
      if (!toInsert) return;
      el.focus();
      const sel = window.getSelection();
      if (!sel) return;
      if (savedSelectionRef.current) {
        sel.removeAllRanges();
        sel.addRange(savedSelectionRef.current);
        savedSelectionRef.current = null;
      }
      try {
        let range: Range;
        if (sel.rangeCount > 0) {
          range = sel.getRangeAt(0);
        } else {
          range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
        }
        range.deleteContents();
        const textNode = document.createTextNode(toInsert);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch {
        document.execCommand('insertText', false, toInsert);
      }
      handleInput(activeEditorRef.current);
    },
    [getActiveEl, handleInput]
  );

  const handleSelectKeywordFromSuggest = useCallback((kw: string) => {
    selectKeywordSuggestRange();
    insertKeyword(kw);
    closeKeywordSuggest();
  }, [selectKeywordSuggestRange, insertKeyword, closeKeywordSuggest]);

  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent, target: 'primary' | 'secondary' = 'primary') => {
      activeEditorRef.current = target;
      const isTargetDisabled = disabled || (target === 'secondary' && secondaryEditor?.disabled);
      if (isTargetDisabled) return;

      if (keywordSuggestPos !== null) {
        const list = filteredKeywordSuggestions;
        const len = list.length;
        if (e.key === 'Backspace') {
          const textBefore = getTextBeforeCursor(target);
          if (textBefore !== null && textBefore.endsWith('[')) {
            closeKeywordSuggest();
          }
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setKeywordSuggestHighlightIndex((i) => (len > 0 ? Math.min(i + 1, len - 1) : 0));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setKeywordSuggestHighlightIndex((i) => (len > 0 ? Math.max(i - 1, 0) : 0));
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          if (len > 0) {
            const idx = Math.min(Math.max(0, keywordSuggestHighlightIndex), len - 1);
            selectKeywordSuggestRange();
            insertKeyword(list[idx]);
          }
          closeKeywordSuggest();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          closeKeywordSuggest();
          return;
        }
      }

      if (keywordDropdownDisabled || keywords.length === 0) return;
      if (e.key === '[') {
        const el = target === 'secondary' ? secondaryEditorRef.current : editorRef.current;
        const sel = window.getSelection();
        if (!el || !sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        if (!el.contains(range.commonAncestorContainer)) return;
        /* Let "[" be inserted by the browser, then show the list after the cursor has moved */
        requestAnimationFrame(() => {
          const sel2 = window.getSelection();
          if (!el || !sel2 || sel2.rangeCount === 0) return;
          const range2 = sel2.getRangeAt(0);
          if (!el.contains(range2.commonAncestorContainer)) return;
          saveSelection();
          const rect = range2.getBoundingClientRect();
          setKeywordSuggestPos({ x: rect.left, y: rect.bottom + 4 });
          setKeywordSuggestQuery('');
          setKeywordSuggestHighlightIndex(0);
        });
      }
    },
    [
      disabled,
      secondaryEditor?.disabled,
      keywordDropdownDisabled,
      keywords.length,
      saveSelection,
      keywordSuggestPos,
      filteredKeywordSuggestions,
      keywordSuggestHighlightIndex,
      insertKeyword,
      closeKeywordSuggest,
      getTextBeforeCursor,
      selectKeywordSuggestRange,
    ]
  );

  const editorStyle = useMemo(
    () => (typeof minHeight === 'number' ? { minHeight: `${minHeight}px` } : { minHeight }),
    [minHeight]
  );

  const secondaryEditorStyle = useMemo(() => {
    const minH = secondaryEditor?.minHeight ?? '120px';
    return typeof minH === 'number' ? { minHeight: `${minH}px` } : { minHeight: minH };
  }, [secondaryEditor?.minHeight]);

  return (
    <div className={`rich-text-editor ${className}`.trim()}>
      {label && (
        <label className="rich-text-editor__label">
          {label}
        </label>
      )}
      <div className="rich-text-editor__toolbar">
        <div className="rich-text-editor__toolbar-group rich-text-editor__toolbar-group--format" onMouseDownCapture={saveSelection}>
          {FORMAT_BUTTONS.map(({ command, icon, label, key }) => (
            <button
              key={key}
              type="button"
              className={withActive('rich-text-editor__toolbar-btn', formatState[key])}
              onClick={() => exec(command)}
              disabled={disabled}
              aria-label={label}
              aria-pressed={formatState[key]}
            >
              <SMSIcon name={icon} size="sm" />
              <span className="rich-text-editor__tooltip" role="tooltip">{label}</span>
            </button>
          ))}
        </div>
        <div className="rich-text-editor__toolbar-divider" aria-hidden />
        <div className="rich-text-editor__toolbar-group" onMouseDownCapture={saveSelection}>
          <div ref={fontSizeDropdownRef} className="rich-text-editor__toolbar-dropdown-wrap">
            <button
              type="button"
              className="rich-text-editor__toolbar-trigger"
              onClick={() => setOpenToolbarDropdown(openToolbarDropdown === 'fontSize' ? null : 'fontSize')}
              disabled={disabled}
              aria-label="Font size"
              aria-expanded={openToolbarDropdown === 'fontSize'}
            >
              <SMSIcon name="format_size" size="sm" className="rich-text-editor__toolbar-select-icon" />
              <span className="rich-text-editor__toolbar-trigger-label">{fontSizeLabel}</span>
              <SMSIcon name="expand_more" size="sm" className="rich-text-editor__toolbar-trigger-chevron" />
              <span className="rich-text-editor__tooltip" role="tooltip">Font size</span>
            </button>
            {openToolbarDropdown === 'fontSize' && (
              <div className="rich-text-editor__toolbar-list">
                {FONT_SIZES.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={withActive('rich-text-editor__toolbar-list-item', formatState.fontSize === opt.value)}
                    onClick={() => {
                      applyFontSize(opt.value);
                      setOpenToolbarDropdown(null);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {showKeywordSection && (
          <>
            <div className="rich-text-editor__toolbar-divider" aria-hidden />
            <div className="rich-text-editor__toolbar-group" onMouseDownCapture={saveSelection}>
              <div ref={keywordDropdownRef} className="rich-text-editor__toolbar-dropdown-wrap">
                <button
                  type="button"
                  className="rich-text-editor__toolbar-trigger"
                  onClick={() => {
                    if (keywordTriggersDisabled) return;
                    if (openToolbarDropdown === 'keyword') {
                      setOpenToolbarDropdown(null);
                      setKeywordDropdownSearchQuery('');
                    } else {
                      setKeywordDropdownSearchQuery('');
                      setOpenToolbarDropdown('keyword');
                    }
                  }}
                  disabled={keywordTriggersDisabled}
                  aria-label="Insert keyword"
                  aria-expanded={openToolbarDropdown === 'keyword'}
                >
                  <SMSIcon name="plus" size="sm" className="rich-text-editor__toolbar-select-icon" />
                  <span className="rich-text-editor__toolbar-trigger-label">Keyword</span>
                  <SMSIcon name="expand_more" size="sm" className="rich-text-editor__toolbar-trigger-chevron" />
                  <span className="rich-text-editor__tooltip" role="tooltip">Insert keyword</span>
                </button>
                {openToolbarDropdown === 'keyword' && !keywordTriggersDisabled && (
                  <div className="rich-text-editor__toolbar-list">
                    {keywords.length === 0 ? (
                      <div className="rich-text-editor__keyword-search-empty" role="status">
                        {EMAIL_TEMPLATES.KEYWORDS.EMPTY_FOR_EMAIL_TYPE}
                      </div>
                    ) : (
                      <>
                        <div className="rich-text-editor__keyword-search-wrap">
                          <input
                            type="text"
                            className="rich-text-editor__keyword-search"
                            placeholder="Search keywords..."
                            value={keywordDropdownSearchQuery}
                            onChange={(e) => setKeywordDropdownSearchQuery(e.target.value)}
                            onMouseDown={(e) => e.stopPropagation()}
                            aria-label="Search keywords"
                            autoFocus
                          />
                        </div>
                        {filteredKeywordDropdownList.length > 0 ? (
                          filteredKeywordDropdownList.map((kw) => (
                            <button
                              key={kw}
                              type="button"
                              className="rich-text-editor__toolbar-list-item"
                              onClick={() => {
                                insertKeyword(kw);
                                setOpenToolbarDropdown(null);
                                setKeywordDropdownSearchQuery('');
                              }}
                            >
                              {kw}
                            </button>
                          ))
                        ) : (
                          <div className="rich-text-editor__keyword-search-empty">No matches</div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        <div className="rich-text-editor__toolbar-divider" aria-hidden />
        <div className="rich-text-editor__toolbar-group">
          <ColorPicker
            ref={textPickerRef}
            title="Text color"
            iconName="format_color_text"
            color={effectiveTextColor}
            defaultColor={DEFAULT_TEXT_COLOR}
            command="foreColor"
            removeValue="#000000"
            disabled={disabled}
            isOpen={openPicker === 'text'}
            onOpenChange={(open) => setOpenPicker(open ? 'text' : null)}
            onColorChange={setTextColor}
            onApplyColor={restoreSelectionAndExec}
            onBeforeOpen={saveSelection}
          />
          <ColorPicker
            ref={highlightPickerRef}
            title="Highlight color"
            iconName="highlight"
            color={effectiveHighlightColor}
            defaultColor={DEFAULT_HIGHLIGHT_COLOR}
            command="backColor"
            removeValue="transparent"
            disabled={disabled}
            isOpen={openPicker === 'highlight'}
            onOpenChange={(open) => setOpenPicker(open ? 'highlight' : null)}
            onColorChange={setHighlightColor}
            onApplyColor={restoreSelectionAndExec}
            onBeforeOpen={saveSelection}
          />
        </div>
      </div>
      <div
        ref={editorRef}
        className="rich-text-editor__body"
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={() => handleInput('primary')}
        onBlur={() => handleEditorBlurWithInput('primary')}
        onKeyDown={(e) => handleEditorKeyDown(e, 'primary')}
        onContextMenu={(e) => handleContextMenu(e, 'primary')}
        onMouseUp={(e) => handleMouseUp(e, 'primary')}
        onFocus={() => {
          activeEditorRef.current = 'primary';
          updateFormatState();
        }}
        style={editorStyle}
        role="textbox"
        aria-label={label || 'Editor'}
      />
      {error && (
        <div className="rich-text-editor__error" role="alert">
          {error}
        </div>
      )}
      {secondaryEditor && (
        <div className="rich-text-editor__secondary">
          {secondaryEditor.label && (
            <label className="rich-text-editor__label" htmlFor={secondaryEditor.id}>
              {secondaryEditor.label}
            </label>
          )}
          <div
            ref={secondaryEditorRef}
            id={secondaryEditor.id}
            className="rich-text-editor__body rich-text-editor__body--secondary"
            contentEditable={!(disabled || secondaryEditor.disabled)}
            suppressContentEditableWarning
            data-placeholder={secondaryEditor.placeholder}
            onInput={() => handleInput('secondary')}
            onBlur={() => handleEditorBlurWithInput('secondary')}
            onKeyDown={(e) => handleEditorKeyDown(e, 'secondary')}
            onContextMenu={(e) => handleContextMenu(e, 'secondary')}
            onMouseUp={(e) => handleMouseUp(e, 'secondary')}
            onFocus={() => {
              activeEditorRef.current = 'secondary';
              updateFormatState();
            }}
            style={secondaryEditorStyle}
            role="textbox"
            aria-label={secondaryEditor.label || 'Editor'}
          />
          {secondaryEditor.error && (
            <div className="rich-text-editor__error" role="alert">
              {secondaryEditor.error}
            </div>
          )}
        </div>
      )}
      {keywordSuggestPos && (
        <div
          ref={keywordSuggestRef}
          className="rich-text-editor__keyword-suggest"
          style={{ left: keywordSuggestPos.x, top: keywordSuggestPos.y }}
          role="listbox"
          aria-activedescendant={filteredKeywordSuggestions.length > 0 ? `keyword-option-${keywordSuggestHighlightIndex}` : undefined}
        >
          {filteredKeywordSuggestions.length > 0 ? (
            filteredKeywordSuggestions.map((kw, index) => {
              const isActive = index === keywordSuggestHighlightIndex;
              return (
                <button
                  key={kw}
                  id={`keyword-option-${index}`}
                  data-keyword-option-index={index}
                  type="button"
                  className={withActive('rich-text-editor__toolbar-list-item', isActive)}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handleSelectKeywordFromSuggest(kw)}
                >
                  {kw}
                </button>
              );
            })
          ) : (
            <div className="rich-text-editor__keyword-suggest-empty">No matches</div>
          )}
        </div>
      )}

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="rich-text-editor__context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
        >
          {FORMAT_BUTTONS.map(({ command, icon, label, key }) => (
            <button
              key={key}
              type="button"
              className={withActive('rich-text-editor__context-icon', formatState[key])}
              role="menuitem"
              aria-label={label}
              aria-pressed={formatState[key]}
              onClick={() => { restoreSelectionAndExec(command, ''); closeContextMenu(); }}
            >
              <SMSIcon name={icon} size="sm" />
              <span className="rich-text-editor__tooltip" role="tooltip">{label}</span>
            </button>
          ))}
          <div className="rich-text-editor__context-sep rich-text-editor__context-sep--horz" />
          <div
            className="rich-text-editor__context-icon-wrap"
            onMouseEnter={() => setContextSubmenuKey('fontSize')}
            onMouseLeave={() => clearContextSubmenuIf('fontSize')}
          >
            <button type="button" className="rich-text-editor__context-icon" role="menuitem" aria-label="Font size">
              <SMSIcon name="format_size" size="sm" />
              <span className="rich-text-editor__tooltip" role="tooltip">Font size</span>
            </button>
            {contextSubmenu === 'fontSize' && (
              <div className="rich-text-editor__toolbar-list rich-text-editor__context-submenu--below">
                {FONT_SIZES.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={withActive('rich-text-editor__toolbar-list-item', formatState.fontSize === opt.value)}
                    onClick={() => { applyFontSize(opt.value); closeContextMenu(); }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div
            className="rich-text-editor__context-icon-wrap"
            onMouseEnter={() => setContextSubmenuKey('textColor')}
            onMouseLeave={() => clearContextSubmenuIf('textColor')}
          >
            <button type="button" className="rich-text-editor__context-icon rich-text-editor__context-icon--color" role="menuitem" aria-label="Text color" style={{ color: effectiveTextColor }}>
              <SMSIcon name="format_color_text" size="sm" />
              <span className="rich-text-editor__tooltip" role="tooltip">Text color</span>
            </button>
            {contextSubmenu === 'textColor' && (
              <div className="rich-text-editor__context-submenu rich-text-editor__context-submenu--below rich-text-editor__context-submenu--colors">
                {PRESET_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    className="rich-text-editor__context-swatch"
                    style={{ backgroundColor: hex }}
                    title={hex}
                    onClick={() => { setTextColor(hex); restoreSelectionAndExec('foreColor', hex); closeContextMenu(); }}
                  />
                ))}
                <label className="rich-text-editor__context-custom">
                  Custom
                  <input
                    type="color"
                    className="rich-text-editor__context-color-input"
                    value={effectiveTextColor}
                    onChange={(e) => { const v = e.target.value; setTextColor(v); restoreSelectionAndExec('foreColor', v); closeContextMenu(); }}
                  />
                </label>
                <button
                  type="button"
                  className="rich-text-editor__context-item rich-text-editor__context-remove-color"
                  onClick={() => { restoreSelectionAndExec('foreColor', '#000000'); setTextColor(DEFAULT_TEXT_COLOR); closeContextMenu(); }}
                >
                  Remove color
                </button>
              </div>
            )}
          </div>
          <div
            className="rich-text-editor__context-icon-wrap"
            onMouseEnter={() => setContextSubmenuKey('highlight')}
            onMouseLeave={() => clearContextSubmenuIf('highlight')}
          >
            <button type="button" className="rich-text-editor__context-icon rich-text-editor__context-icon--color" role="menuitem" aria-label="Highlight" style={{ color: effectiveHighlightColor }}>
              <SMSIcon name="highlight" size="sm" />
              <span className="rich-text-editor__tooltip" role="tooltip">Highlight</span>
            </button>
            {contextSubmenu === 'highlight' && (
              <div className="rich-text-editor__context-submenu rich-text-editor__context-submenu--below rich-text-editor__context-submenu--colors">
                {PRESET_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    className="rich-text-editor__context-swatch"
                    style={{ backgroundColor: hex }}
                    title={hex}
                    onClick={() => { setHighlightColor(hex); restoreSelectionAndExec('backColor', hex); closeContextMenu(); }}
                  />
                ))}
                <label className="rich-text-editor__context-custom">
                  Custom
                  <input
                    type="color"
                    className="rich-text-editor__context-color-input"
                    value={effectiveHighlightColor}
                    onChange={(e) => { const v = e.target.value; setHighlightColor(v); restoreSelectionAndExec('backColor', v); closeContextMenu(); }}
                  />
                </label>
                <button
                  type="button"
                  className="rich-text-editor__context-item rich-text-editor__context-remove-color"
                  onClick={() => { restoreSelectionAndExec('backColor', 'transparent'); setHighlightColor(DEFAULT_HIGHLIGHT_COLOR); closeContextMenu(); }}
                >
                  Remove highlight
                </button>
              </div>
            )}
          </div>
          {showKeywordSection && (
            <>
              <div className="rich-text-editor__context-sep rich-text-editor__context-sep--horz" />
              <div
                className="rich-text-editor__context-icon-wrap"
                onMouseEnter={() => {
                  if (keywordTriggersDisabled) return;
                  setKeywordDropdownSearchQuery('');
                  setContextSubmenuKey('keyword');
                }}
                onMouseLeave={() => clearContextSubmenuIf('keyword')}
              >
                <button
                  type="button"
                  className="rich-text-editor__context-icon"
                  role="menuitem"
                  aria-label="Insert keyword"
                  disabled={keywordTriggersDisabled}
                >
                  <SMSIcon name="plus" size="sm" />
                  <span className="rich-text-editor__tooltip" role="tooltip">Insert keyword</span>
                </button>
                {contextSubmenu === 'keyword' && !keywordTriggersDisabled && (
                  <div className="rich-text-editor__toolbar-list rich-text-editor__context-submenu--below">
                    {keywords.length === 0 ? (
                      <div className="rich-text-editor__keyword-search-empty" role="status">
                        {EMAIL_TEMPLATES.KEYWORDS.EMPTY_FOR_EMAIL_TYPE}
                      </div>
                    ) : (
                      <>
                        <div className="rich-text-editor__keyword-search-wrap">
                          <input
                            type="text"
                            className="rich-text-editor__keyword-search"
                            placeholder="Search keywords..."
                            value={keywordDropdownSearchQuery}
                            onChange={(e) => setKeywordDropdownSearchQuery(e.target.value)}
                            onMouseDown={(e) => e.stopPropagation()}
                            aria-label="Search keywords"
                          />
                        </div>
                        {filteredKeywordDropdownList.length > 0 ? (
                          filteredKeywordDropdownList.map((kw) => (
                            <button
                              key={kw}
                              type="button"
                              className="rich-text-editor__toolbar-list-item"
                              onClick={() => { insertKeyword(kw); setKeywordDropdownSearchQuery(''); closeContextMenu(); }}
                            >
                              {kw}
                            </button>
                          ))
                        ) : (
                          <div className="rich-text-editor__keyword-search-empty">No matches</div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
