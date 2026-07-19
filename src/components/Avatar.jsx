export default function Avatar({ bg, initial, size = 42, fontSize = 16, className }) {
  return (
    <div
      className={className ? `patient-avatar ${className}` : "patient-avatar"}
      style={{ width: size, height: size, background: bg, fontSize }}
    >
      {initial}
    </div>
  );
}
