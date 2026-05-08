import { useEffect, useRef } from "react";

type RichHtmlEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeightClassName?: string;
};

export default function RichHtmlEditor({
  value,
  onChange,
  placeholder,
  minHeightClassName = "min-h-[220px]",
}: RichHtmlEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const runCommand = (command: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML ?? "");
  };

  const insertTable = () => {
    const tableHtml = `<table style="width:100%; border-collapse:collapse;"><tr><th style="border:1px solid #cbd5e1; padding:8px;">Heading</th><th style="border:1px solid #cbd5e1; padding:8px;">Value</th></tr><tr><td style="border:1px solid #cbd5e1; padding:8px;">Quote</td><td style="border:1px solid #cbd5e1; padding:8px;">{{quote.quote_no}}</td></tr></table><p></p>`;
    runCommand("insertHTML", tableHtml);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
        {[
          { label: "B", action: () => runCommand("bold") },
          { label: "I", action: () => runCommand("italic") },
          { label: "U", action: () => runCommand("underline") },
          { label: "List", action: () => runCommand("insertUnorderedList") },
          { label: "H2", action: () => runCommand("formatBlock", "<h2>") },
          { label: "Table", action: insertTable },
          { label: "Blue", action: () => runCommand("foreColor", "#1d4ed8") },
          { label: "Green", action: () => runCommand("foreColor", "#15803d") },
          { label: "🙂", action: () => runCommand("insertText", "🙂") },
          { label: "📦", action: () => runCommand("insertText", "📦") },
        ].map((button) => (
          <button
            key={button.label}
            type="button"
            onClick={button.action}
            className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted"
          >
            {button.label}
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(editorRef.current?.innerHTML ?? "")}
        className={`${minHeightClassName} px-4 py-3 text-sm focus:outline-none`}
        style={{ whiteSpace: "pre-wrap" }}
      />
      {!value && placeholder ? (
        <div className="pointer-events-none -mt-[212px] px-4 py-3 text-sm text-muted-foreground">{placeholder}</div>
      ) : null}
    </div>
  );
}