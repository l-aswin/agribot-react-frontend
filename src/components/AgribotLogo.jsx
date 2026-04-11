import agribotLogoImg from '../assets/logo.png';

/**
 * AgriBot logo
 * Props:
 *   size      – number, controls height of the icon (default 40)
 *   showText  – boolean, show "AgriBot" wordmark beside the icon (default true)
 *   textSize  – number, font-size for the wordmark in px (default 22)
 *   dark      – boolean, use dark text for light backgrounds (default false)
 */
export default function AgribotLogo({
  size = 40,
  showText = true,
  textSize = 22,
  dark = false,
}) {
  const textColor = dark ? '#15803d' : '#fff';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, userSelect: 'none' }}>
      <img
        src={agribotLogoImg}
        alt="AgriBot logo"
        style={{ height: size, width: 'auto', display: 'block', borderRadius: '22%' }}
      />

      {/* Wordmark */}
      {showText && (
        <span
          style={{
            fontSize: textSize,
            fontWeight: 700,
            letterSpacing: '-0.3px',
            color: textColor,
            fontFamily: "'Inter', system-ui, sans-serif",
            lineHeight: 1,
          }}
        >
          AgriBot
        </span>
      )}
    </div>
  );
}
