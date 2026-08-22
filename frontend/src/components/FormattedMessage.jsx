// Lightweight formatter for assistant replies -- handles the small markdown
// subset the system prompt asks GPT to use (### short headings, "- " bullet
// lists, **bold**) without pulling in a markdown library or using
// dangerouslySetInnerHTML. Plain rule-based-assistant text (no markdown)
// just renders as a single paragraph.
function renderInline(text, keyPrefix) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{part}</span>
    )
  );
}

export default function FormattedMessage({ text }) {
  const lines = (text || "").split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const blocks = [];
  let bulletBuffer = [];

  function flushBullets(key) {
    if (bulletBuffer.length === 0) return;
    blocks.push(
      <ul key={`ul-${key}`} className="list-disc pl-4 space-y-0.5">
        {bulletBuffer.map((b, i) => <li key={i}>{renderInline(b, `b${key}-${i}`)}</li>)}
      </ul>
    );
    bulletBuffer = [];
  }

  lines.forEach((line, i) => {
    if (/^#{1,3}\s+/.test(line)) {
      flushBullets(i);
      blocks.push(<div key={`h-${i}`} className="font-bold">{renderInline(line.replace(/^#{1,3}\s+/, ""), `h${i}`)}</div>);
    } else if (/^[-*]\s+/.test(line)) {
      bulletBuffer.push(line.replace(/^[-*]\s+/, ""));
    } else {
      flushBullets(i);
      blocks.push(<p key={`p-${i}`}>{renderInline(line, `p${i}`)}</p>);
    }
  });
  flushBullets("end");

  return <div className="space-y-1.5">{blocks}</div>;
}
