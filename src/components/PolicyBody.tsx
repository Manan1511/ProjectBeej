export function PolicyBody({ body }: { body: string }) {
  return <div className="policy-copy">{body.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph.trim()}</p>)}</div>;
}
