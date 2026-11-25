export default function Panel({ title, right, rightId, children }) {
  return (
    <section className="panel">
      <div className="hd">
        <span>{title}</span>
        {right != null && <span id={rightId}>{right}</span>}
      </div>
      {children}
    </section>
  );
}
