import React, { useState } from 'react';
import '../ui-kit.css';

/* ---------------------------------------------------------
   1. Corner Halftone Bubble Pattern SVG (Matches Reference Image 2)
   --------------------------------------------------------- */
export function CornerHalftoneBackground() {
  return (
    <svg
      className="kit-corner-dots"
      viewBox="0 0 360 480"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="cornerHoleTL" cx="0%" cy="0%" r="65%">
          <stop offset="0%" stopColor="#ede2f8" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#f7f2fc" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cornerHoleTR" cx="100%" cy="0%" r="65%">
          <stop offset="0%" stopColor="#ede2f8" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#f7f2fc" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cornerHoleBL" cx="0%" cy="100%" r="55%">
          <stop offset="0%" stopColor="#ede2f8" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cornerHoleBR" cx="100%" cy="100%" r="55%">
          <stop offset="0%" stopColor="#ede2f8" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Soft Corner Vignettes */}
      <rect x="0" y="0" width="200" height="200" fill="url(#cornerHoleTL)" />
      <rect x="160" y="0" width="200" height="200" fill="url(#cornerHoleTR)" />
      <rect x="0" y="320" width="180" height="160" fill="url(#cornerHoleBL)" />
      <rect x="180" y="320" width="180" height="160" fill="url(#cornerHoleBR)" />

      {/* Top-Left Radial Halftone Circles (Soft Lavender) */}
      <g fill="#c8abf4">
        {/* Ring 1 (r=12) */}
        <circle cx="20" cy="12" r="12" opacity="0.95" />
        <circle cx="12" cy="24" r="12" opacity="0.95" />

        {/* Ring 2 (r=9.5) */}
        <circle cx="48" cy="14" r="9.5" opacity="0.92" />
        <circle cx="38" cy="32" r="9.5" opacity="0.92" />
        <circle cx="22" cy="48" r="9.5" opacity="0.92" />
        <circle cx="8" cy="56" r="9" opacity="0.9" />

        {/* Ring 3 (r=7.5) */}
        <circle cx="78" cy="16" r="7.5" opacity="0.88" />
        <circle cx="68" cy="38" r="7.5" opacity="0.88" />
        <circle cx="52" cy="56" r="7.5" opacity="0.88" />
        <circle cx="34" cy="72" r="7.5" opacity="0.88" />
        <circle cx="14" cy="84" r="7.5" opacity="0.88" />

        {/* Ring 4 (r=5.5) */}
        <circle cx="108" cy="20" r="5.5" opacity="0.82" />
        <circle cx="96" cy="44" r="5.5" opacity="0.82" />
        <circle cx="80" cy="68" r="5.5" opacity="0.82" />
        <circle cx="60" cy="88" r="5.5" opacity="0.82" />
        <circle cx="38" cy="104" r="5.5" opacity="0.82" />
        <circle cx="16" cy="116" r="5.5" opacity="0.82" />

        {/* Ring 5 (r=4) */}
        <circle cx="138" cy="24" r="4" opacity="0.75" />
        <circle cx="124" cy="50" r="4" opacity="0.75" />
        <circle cx="106" cy="76" r="4" opacity="0.75" />
        <circle cx="84" cy="100" r="4" opacity="0.75" />
        <circle cx="60" cy="122" r="4" opacity="0.75" />
        <circle cx="34" cy="138" r="4" opacity="0.75" />
        <circle cx="12" cy="148" r="4" opacity="0.7" />

        {/* Ring 6 (r=2.8) */}
        <circle cx="166" cy="28" r="2.8" opacity="0.65" />
        <circle cx="150" cy="56" r="2.8" opacity="0.65" />
        <circle cx="130" cy="84" r="2.8" opacity="0.65" />
        <circle cx="108" cy="110" r="2.8" opacity="0.65" />
        <circle cx="82" cy="134" r="2.8" opacity="0.65" />
        <circle cx="54" cy="154" r="2.8" opacity="0.65" />
        <circle cx="26" cy="170" r="2.8" opacity="0.6" />

        {/* Ring 7 (r=2) */}
        <circle cx="192" cy="34" r="2" opacity="0.5" />
        <circle cx="174" cy="64" r="2" opacity="0.5" />
        <circle cx="152" cy="94" r="2" opacity="0.5" />
        <circle cx="128" cy="122" r="2" opacity="0.5" />
        <circle cx="100" cy="148" r="2" opacity="0.5" />
        <circle cx="70" cy="170" r="2" opacity="0.5" />
        <circle cx="40" cy="188" r="2" opacity="0.45" />
      </g>

      {/* Top-Right Radial Halftone Circles (Mirrored Soft Lavender) */}
      <g fill="#c8abf4">
        {/* Ring 1 (r=12) */}
        <circle cx="340" cy="12" r="12" opacity="0.95" />
        <circle cx="348" cy="24" r="12" opacity="0.95" />

        {/* Ring 2 (r=9.5) */}
        <circle cx="312" cy="14" r="9.5" opacity="0.92" />
        <circle cx="322" cy="32" r="9.5" opacity="0.92" />
        <circle cx="338" cy="48" r="9.5" opacity="0.92" />
        <circle cx="352" cy="56" r="9" opacity="0.9" />

        {/* Ring 3 (r=7.5) */}
        <circle cx="282" cy="16" r="7.5" opacity="0.88" />
        <circle cx="292" cy="38" r="7.5" opacity="0.88" />
        <circle cx="308" cy="56" r="7.5" opacity="0.88" />
        <circle cx="326" cy="72" r="7.5" opacity="0.88" />
        <circle cx="346" cy="84" r="7.5" opacity="0.88" />

        {/* Ring 4 (r=5.5) */}
        <circle cx="252" cy="20" r="5.5" opacity="0.82" />
        <circle cx="264" cy="44" r="5.5" opacity="0.82" />
        <circle cx="280" cy="68" r="5.5" opacity="0.82" />
        <circle cx="300" cy="88" r="5.5" opacity="0.82" />
        <circle cx="322" cy="104" r="5.5" opacity="0.82" />
        <circle cx="344" cy="116" r="5.5" opacity="0.82" />

        {/* Ring 5 (r=4) */}
        <circle cx="222" cy="24" r="4" opacity="0.75" />
        <circle cx="236" cy="50" r="4" opacity="0.75" />
        <circle cx="254" cy="76" r="4" opacity="0.75" />
        <circle cx="276" cy="100" r="4" opacity="0.75" />
        <circle cx="300" cy="122" r="4" opacity="0.75" />
        <circle cx="326" cy="138" r="4" opacity="0.75" />
        <circle cx="348" cy="148" r="4" opacity="0.7" />

        {/* Ring 6 (r=2.8) */}
        <circle cx="194" cy="28" r="2.8" opacity="0.65" />
        <circle cx="210" cy="56" r="2.8" opacity="0.65" />
        <circle cx="230" cy="84" r="2.8" opacity="0.65" />
        <circle cx="252" cy="110" r="2.8" opacity="0.65" />
        <circle cx="278" cy="134" r="2.8" opacity="0.65" />
        <circle cx="306" cy="154" r="2.8" opacity="0.65" />
        <circle cx="334" cy="170" r="2.8" opacity="0.6" />

        {/* Ring 7 (r=2) */}
        <circle cx="168" cy="34" r="2" opacity="0.5" />
        <circle cx="186" cy="64" r="2" opacity="0.5" />
        <circle cx="208" cy="94" r="2" opacity="0.5" />
        <circle cx="232" cy="122" r="2" opacity="0.5" />
        <circle cx="260" cy="148" r="2" opacity="0.5" />
        <circle cx="290" cy="170" r="2" opacity="0.5" />
        <circle cx="320" cy="188" r="2" opacity="0.45" />
      </g>

      {/* Bottom Subtle Lavender Bokeh & Halftone Dots */}
      <g fill="#c8abf4">
        {/* Bottom-Left */}
        <circle cx="14" cy="466" r="14" opacity="0.7" />
        <circle cx="42" cy="470" r="10" opacity="0.65" />
        <circle cx="22" cy="440" r="8.5" opacity="0.6" />
        <circle cx="54" cy="444" r="6.5" opacity="0.55" />
        <circle cx="34" cy="418" r="5" opacity="0.5" />
        <circle cx="68" cy="422" r="4" opacity="0.45" />

        {/* Bottom-Right */}
        <circle cx="346" cy="466" r="14" opacity="0.7" />
        <circle cx="318" cy="470" r="10" opacity="0.65" />
        <circle cx="338" cy="440" r="8.5" opacity="0.6" />
        <circle cx="306" cy="444" r="6.5" opacity="0.55" />
        <circle cx="326" cy="418" r="5" opacity="0.5" />
        <circle cx="292" cy="422" r="4" opacity="0.45" />
      </g>

      {/* Whimsical 4-Point Diamond Sparkles */}
      <g fill="#b993ef">
        <polygon points="120,40 123,46 120,52 117,46" opacity="0.75" />
        <polygon points="240,40 243,46 240,52 237,46" opacity="0.75" />
        <polygon points="50,165 52,169 50,173 48,169" opacity="0.65" />
        <polygon points="310,165 312,169 310,173 308,169" opacity="0.65" />
        <polygon points="45,410 47,414 45,418 43,414" opacity="0.6" />
        <polygon points="315,410 317,414 315,418 313,414" opacity="0.6" />
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------
   2. Plump 3D Golden Star SVG Icon
   --------------------------------------------------------- */
export function GoldStarSvg({ size = 24, unearned = false }: { size?: number; unearned?: boolean }) {
  const gradId = unearned ? 'silverStarGrad' : 'goldStarGrad';
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ filter: unearned ? 'drop-shadow(0 2px 0 #555)' : 'drop-shadow(0 2px 0 #7a3000)' }}>
      <defs>
        <linearGradient id="goldStarGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff066" />
          <stop offset="55%" stopColor="#fcb017" />
          <stop offset="100%" stopColor="#e87704" />
        </linearGradient>
        <linearGradient id="silverStarGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0f2f5" />
          <stop offset="55%" stopColor="#c5cbd3" />
          <stop offset="100%" stopColor="#9aa1ab" />
        </linearGradient>
      </defs>
      <path
        d="M16 2.5c1.1 0 2.1.6 2.6 1.6l2.5 5.1 5.6.8c1.1.2 2 .9 2.3 2 .3 1.1 0 2.2-.8 3l-4.1 4 1 5.6c.2 1.1-.3 2.2-1.2 2.8-.9.7-2.1.7-3.1.2L16 25l-5 2.6c-1 .5-2.2.4-3.1-.2-.9-.7-1.4-1.7-1.2-2.8l1-5.6-4.1-4c-.8-.8-1.1-1.9-.8-3 .3-1.1 1.2-1.8 2.3-2l5.6-.8 2.5-5.1c.5-1 1.5-1.6 2.8-1.6z"
        fill={`url(#${gradId})`}
        stroke={unearned ? '#5c636e' : '#943b00'}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Top glossy highlight */}
      <path
        d="M16 5.2l2.1 4.4 4.8.7"
        fill="none"
        stroke={unearned ? '#ffffff' : '#fff9b0'}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ---------------------------------------------------------
   3. Oversized 3D Gold Checkmark SVG (For Purple Checkbox)
   --------------------------------------------------------- */
export function GoldCheckmarkSvg() {
  return (
    <svg
      width="30"
      height="28"
      viewBox="0 0 30 28"
      style={{
        position: 'absolute',
        top: '-4px',
        right: '-5px',
        filter: 'drop-shadow(0 2px 0 #6b2300)',
        pointerEvents: 'none',
      }}
    >
      <defs>
        <linearGradient id="checkGoldGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe863" />
          <stop offset="60%" stopColor="#fba514" />
          <stop offset="100%" stopColor="#e57704" />
        </linearGradient>
      </defs>
      <path
        d="M5 14.5l6.2 6.2L25.5 5.5"
        fill="none"
        stroke="#9c3f00"
        strokeWidth="7.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 14.5l6.2 6.2L25.5 5.5"
        fill="none"
        stroke="url(#checkGoldGrad)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---------------------------------------------------------
   4. Complete Interactive Replica of the Reference Panel
   --------------------------------------------------------- */
export function UIKitShowcase({
  title = 'Title here',
  onClose,
}: {
  title?: string;
  onClose?: () => void;
}) {
  const [inputValue, setInputValue] = useState('');
  const [toggleLeft, setToggleLeft] = useState(false);
  const [toggleRight, setToggleRight] = useState(true);
  const [checkedA, setCheckedA] = useState(true);
  const [checkedB, setCheckedB] = useState(false);
  const [sliderValue, setSliderValue] = useState(41);

  return (
    <div className="kit-window">
      {/* Overlapping Purple Header Ribbon */}
      <div className="kit-header-ribbon">
        <span className="kit-header-title">{title}</span>
      </div>

      {/* Overlapping Purple Close Button */}
      <button
        type="button"
        className="kit-close-btn"
        onClick={onClose}
        aria-label="Close modal"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" style={{ position: 'relative', zIndex: 1 }}>
          <path
            d="M5 5l14 14M19 5L5 19"
            stroke="#f5edff"
            strokeWidth="5"
            strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 2.5px 0 #481487)' }}
          />
        </svg>
      </button>

      {/* Inner White/Lavender Card with Halftone Corner Dots */}
      <div className="kit-canvas">
        <CornerHalftoneBackground />

        <div className="kit-content">
          {/* ROW 1: Silver Circle | Gold Pause Circle | 3-Star Bar & Resource Pill */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <button type="button" className="kit-round-btn kit-round-btn--silver" aria-label="Blank button" />

            <button type="button" className="kit-round-btn kit-round-btn--gold" aria-label="Pause">
              <span className="kit-pause-icon">
                <span className="kit-pause-bar" />
                <span className="kit-pause-bar" />
              </span>
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-end' }}>
              {/* 3-Star Progress Bar */}
              <div className="kit-star-bar">
                <div className="kit-star-bar-fill" style={{ width: '86%' }} />
                <div className="kit-star-icons">
                  <GoldStarSvg size={24} />
                  <GoldStarSvg size={24} />
                  <GoldStarSvg size={24} />
                </div>
              </div>

              {/* Charcoal Resource Counter with "+" */}
              <div className="kit-resource-pill">
                <button type="button" className="kit-plus-btn" aria-label="Add resource">
                  +
                </button>
              </div>
            </div>
          </div>

          {/* ROW 2: Recessed White Text Input */}
          <input
            type="text"
            className="kit-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            aria-label="Text input"
          />

          {/* ROW 3: Two Toggles + Checked & Unchecked Checkboxes */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <button
              type="button"
              className="kit-toggle kit-toggle--amber"
              onClick={() => setToggleLeft(!toggleLeft)}
              aria-label="Amber toggle"
            >
              <span
                className="kit-toggle-thumb"
                style={{ left: toggleLeft ? '22px' : '0px' }}
              />
            </button>

            <button
              type="button"
              className="kit-toggle kit-toggle--lavender"
              onClick={() => setToggleRight(!toggleRight)}
              aria-label="Lavender toggle"
            >
              <span
                className="kit-toggle-thumb"
                style={{ left: toggleRight ? '22px' : '0px' }}
              />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button
                type="button"
                className={`kit-checkbox ${checkedA ? 'kit-checkbox--checked' : 'kit-checkbox--unchecked'}`}
                onClick={() => setCheckedA(!checkedA)}
                aria-label="Checkbox 1"
              >
                {checkedA && <GoldCheckmarkSvg />}
              </button>

              <button
                type="button"
                className={`kit-checkbox ${checkedB ? 'kit-checkbox--checked' : 'kit-checkbox--unchecked'}`}
                onClick={() => setCheckedB(!checkedB)}
                aria-label="Checkbox 2"
              >
                {checkedB && <GoldCheckmarkSvg />}
              </button>
            </div>
          </div>

          {/* ROW 4: Candy-Striped Slider Bar */}
          <div className="kit-slider-wrap">
            <div className="kit-slider-groove">
              <div className="kit-slider-track">
                <div
                  className="kit-slider-fill"
                  style={{
                    width: `${sliderValue}%`,
                    display: sliderValue === 0 ? 'none' : 'block',
                  }}
                />
              </div>
              <div
                className="kit-slider-thumb"
                style={{
                  left: `calc(${sliderValue}% - ${(sliderValue * 0.32).toFixed(2)}px)`,
                }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={sliderValue}
              onChange={(e) => setSliderValue(Number(e.target.value))}
              onInput={(e) => setSliderValue(Number((e.target as HTMLInputElement).value))}
              className="kit-slider-input"
              aria-label="Volume slider"
            />
          </div>

          {/* Horizontal Divider */}
          <div className="kit-divider" />

          {/* ROW 5: Three Small Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <button type="button" className="kit-btn kit-btn--sm kit-btn--gold">
              <span className="kit-btn-label" />
            </button>
            <button type="button" className="kit-btn kit-btn--sm kit-btn--purple">
              <span className="kit-btn-label" />
            </button>
            <button type="button" className="kit-btn kit-btn--sm kit-btn--green">
              <span className="kit-btn-label">Caption</span>
            </button>
          </div>

          {/* ROW 6: Two Medium Buttons (Retry & Next matching Image 1) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <button type="button" className="kit-btn kit-btn--md kit-btn--purple">
              <span className="kit-btn-label">Retry</span>
            </button>
            <button type="button" className="kit-btn kit-btn--md kit-btn--gold">
              <span className="kit-btn-label">Next</span>
            </button>
          </div>

          {/* ROW 6b: Caption Buttons (Matching Image 3) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <button type="button" className="kit-btn kit-btn--md kit-btn--purple">
              <span className="kit-btn-label">Caption</span>
            </button>
            <button type="button" className="kit-btn kit-btn--md kit-btn--gold">
              <span className="kit-btn-label">Caption</span>
            </button>
          </div>

          {/* ROW 7: Full-Width Large Gold Button (Matching Image 3) */}
          <button type="button" className="kit-btn kit-btn--lg kit-btn--gold">
            <span className="kit-btn-label">Large button</span>
          </button>
        </div>
      </div>
    </div>
  );
}
