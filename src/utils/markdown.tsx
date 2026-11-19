import React, {useState} from 'react';
import {Check, Copy, ExternalLink, FileText, ImageOff} from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  imageUrls?: Record<string, string>;
  knowHowTitles?: string[];
  onWikiLinkClick?: (title: string) => void;
  onImageClick?: (imageId: string) => void;
  onToggleTaskLine?: (lineIndex: number, nextChecked: boolean) => void;
  emptyText?: string;
}

function CopyCodeButton({code}: {code: string}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore clipboard denial
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 whitespace-nowrap shrink-0"
      title="Kodu kopyala"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      <span>{copied ? 'Kopyalandı' : 'Kopyala'}</span>
    </button>
  );
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  imageUrls = {},
  knowHowTitles = [],
  onWikiLinkClick,
  onImageClick,
  onToggleTaskLine,
  emptyText = 'Henüz içerik eklenmemiş.',
}) => {
  if (!content || !content.trim()) {
    return (
      <p className="text-sm italic text-zinc-400 dark:text-zinc-500">
        {emptyText}
      </p>
    );
  }

  const normalizedTitles = new Set(knowHowTitles.map((t) => t.trim().toLowerCase()));

  const renderInline = (text: string, keyPrefix: string): React.ReactNode[] => {
    // Tokenize: inline images ![alt](img:id), wiki links [[Title]], links [text](url), bold **...**, italic *...*, strike ~~...~~, inline code `...`
    const tokenRegex =
      /(!\[[^\]]*\]\(img:[^)]+\)|\[\[[^[\]]+\]\]|\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~)/g;
    const parts = text.split(tokenRegex);

    return parts.map((part, idx) => {
      if (!part) return null;
      const key = `${keyPrefix}-${idx}`;

      // Inline IndexedDB image: ![alt](img:id)
      const imgMatch = part.match(/^!\[([^\]]*)\]\(img:([^)]+)\)$/);
      if (imgMatch) {
        const [, alt, imgId] = imgMatch;
        const src = imageUrls[imgId];
        if (!src) {
          return (
            <span
              key={key}
              className="my-2 inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
            >
              <ImageOff className="h-4 w-4 shrink-0" />
              <span>Görsel bulunamadı ({alt || imgId})</span>
            </span>
          );
        }
        return (
          <button
            key={key}
            type="button"
            onClick={() => onImageClick?.(imgId)}
            className="my-2 block max-w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 text-left transition-transform hover:scale-[1.005] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <img
              src={src}
              alt={alt || 'Ekli görsel'}
              referrerPolicy="no-referrer"
              className="max-h-80 w-auto object-contain"
            />
          </button>
        );
      }

      // Wiki link: [[Title]]
      const wikiMatch = part.match(/^\[\[([^[\]]+)\]\]$/);
      if (wikiMatch) {
        const title = wikiMatch[1].trim();
        const exists = normalizedTitles.has(title.toLowerCase());
        return (
          <button
            key={key}
            type="button"
            onClick={() => onWikiLinkClick?.(title)}
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.92em] font-medium transition-colors align-baseline ${
              exists
                ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
            }`}
            title={exists ? `Know-How kaydını aç: ${title}` : `Eşleşen Know-How bulunamadı: ${title}`}
          >
            <FileText className="h-3 w-3 shrink-0" />
            <span>{title}</span>
          </button>
        );
      }

      // External markdown link: [text](url)
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        const safeHref = /^https?:\/\//i.test(href) || href.startsWith('/') ? href : '#';
        return (
          <a
            key={key}
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 font-medium text-blue-600 underline decoration-blue-600/30 underline-offset-2 hover:decoration-blue-600 dark:text-blue-400"
          >
            <span>{label}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        );
      }

      // Inline code
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code
            key={key}
            className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.85em] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      // Bold
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return (
          <strong key={key} className="font-semibold text-zinc-950 dark:text-zinc-50">
            {part.slice(2, -2)}
          </strong>
        );
      }

      // Italic
      if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
        return (
          <em key={key} className="italic">
            {part.slice(1, -1)}
          </em>
        );
      }

      // Strikethrough
      if (part.startsWith('~~') && part.endsWith('~~') && part.length >= 4) {
        return (
          <del key={key} className="text-zinc-400 line-through dark:text-zinc-500">
            {part.slice(2, -2)}
          </del>
        );
      }

      return <React.Fragment key={key}>{part}</React.Fragment>;
    });
  };

  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      const startIndex = i;
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const codeText = codeLines.join('\n');
      blocks.push(
        <div
          key={`code-${startIndex}`}
          className="my-3 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-1.5 dark:border-zinc-800">
            <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
              {lang || 'kod'}
            </span>
            <CopyCodeButton code={codeText} />
          </div>
          <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-zinc-800 dark:text-zinc-200">
            <code>{codeText}</code>
          </pre>
        </div>
      );
      continue;
    }

    // Horizontal rule
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push(<hr key={`hr-${i}`} className="my-4 border-zinc-200 dark:border-zinc-800" />);
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      if (level === 1) {
        blocks.push(
          <h1
            key={`h1-${i}`}
            className="mt-5 mb-2 text-xl font-semibold tracking-tight text-zinc-950 first:mt-0 dark:text-zinc-50"
          >
            {renderInline(text, `h1-${i}`)}
          </h1>
        );
      } else if (level === 2) {
        blocks.push(
          <h2
            key={`h2-${i}`}
            className="mt-4 mb-2 text-base font-semibold tracking-tight text-zinc-900 first:mt-0 dark:text-zinc-100"
          >
            {renderInline(text, `h2-${i}`)}
          </h2>
        );
      } else {
        blocks.push(
          <h3
            key={`h3-${i}`}
            className="mt-3 mb-1.5 text-sm font-semibold text-zinc-900 first:mt-0 dark:text-zinc-100"
          >
            {renderInline(text, `h3-${i}`)}
          </h3>
        );
      }
      i++;
      continue;
    }

    // Blockquote (clean hairline card without thick left border)
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = [];
      const startIndex = i;
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      blocks.push(
        <blockquote
          key={`bq-${startIndex}`}
          className="my-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300"
        >
          {quoteLines.map((qLine, qIdx) => (
            <p key={`bq-${startIndex}-${qIdx}`} className="leading-relaxed">
              {renderInline(qLine, `bq-${startIndex}-${qIdx}`)}
            </p>
          ))}
        </blockquote>
      );
      continue;
    }

    // Unordered list or task checklist
    if (/^\s*[-*]\s+/.test(line)) {
      const listItems: {lineIndex: number; text: string; isTask: boolean; checked: boolean}[] = [];
      const startIndex = i;
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const raw = lines[i].replace(/^\s*[-*]\s+/, '');
        const taskMatch = raw.match(/^\[( |x|X)\]\s+(.*)$/);
        if (taskMatch) {
          listItems.push({
            lineIndex: i,
            text: taskMatch[2],
            isTask: true,
            checked: taskMatch[1].toLowerCase() === 'x',
          });
        } else {
          listItems.push({
            lineIndex: i,
            text: raw,
            isTask: false,
            checked: false,
          });
        }
        i++;
      }

      blocks.push(
        <ul key={`ul-${startIndex}`} className="my-2.5 space-y-1.5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          {listItems.map((item) => (
            <li key={`li-${item.lineIndex}`} className="flex items-start gap-2.5">
              {item.isTask ? (
                <button
                  type="button"
                  disabled={!onToggleTaskLine}
                  onClick={() => onToggleTaskLine?.(item.lineIndex, !item.checked)}
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                    item.checked
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900'
                  } ${onToggleTaskLine ? 'cursor-pointer hover:border-blue-500' : 'cursor-default'}`}
                  aria-label={item.checked ? 'Tamamlandı olarak işaretli' : 'Tamamlanmadı'}
                >
                  {item.checked && <Check className="h-3 w-3 stroke-[2.5]" />}
                </button>
              ) : (
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-500" aria-hidden="true" />
              )}
              <span className={item.isTask && item.checked ? 'text-zinc-400 line-through dark:text-zinc-500' : ''}>
                {renderInline(item.text, `li-${item.lineIndex}`)}
              </span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const listItems: {lineIndex: number; text: string; num: string}[] = [];
      const startIndex = i;
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        const match = lines[i].match(/^\s*(\d+)\.\s+(.*)$/);
        if (match) {
          listItems.push({lineIndex: i, num: match[1], text: match[2]});
        }
        i++;
      }
      blocks.push(
        <ol key={`ol-${startIndex}`} className="my-2.5 space-y-1.5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          {listItems.map((item) => (
            <li key={`oli-${item.lineIndex}`} className="flex items-start gap-2.5">
              <span className="min-w-[1.25rem] font-mono text-xs font-medium text-zinc-500 tabular-nums pt-0.5 dark:text-zinc-400">
                {item.num}.
              </span>
              <span>{renderInline(item.text, `oli-${item.lineIndex}`)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Empty line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Paragraph
    const paraLines: string[] = [];
    const startIndex = i;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !/^#{1,3}\s+/.test(lines[i]) &&
      !lines[i].trim().startsWith('>') &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*([-*_])\1{2,}\s*$/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={`p-${startIndex}`} className="my-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        {renderInline(paraLines.join(' '), `p-${startIndex}`)}
      </p>
    );
  }

  return <div className="space-y-1">{blocks}</div>;
};
