
export default function Skeleton({ width = '100%', height = 16, style }) {
  return <span className="cs-skeleton" aria-hidden="true" style={{ width, height, ...style }} />;
}
