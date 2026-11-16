import React, { useState } from 'react';
import '../ui-kit.css';

/* ---------------------------------------------------------
   1. Corner Halftone Bubble Pattern SVG (Matches Reference)
   --------------------------------------------------------- */
export function CornerHalftoneBackground() {
  return (
    <svg
      className="kit-corner-dots"
      viewBox="0 0 700 700"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g fill="#ffffff">
        <circle cx="0" cy="0" r="48" />
        <circle cx="35" cy="10" r="38" />
        <circle cx="75" cy="15" r="30" />
        <circle cx="115" cy="20" r="26" />
        <circle cx="155" cy="25" r="22" />
        <circle cx="0" cy="45" r="42" />
        <circle cx="35" cy="55" r="34" />
        <circle cx="75" cy="58" r="28" />
        <circle cx="115" cy="62" r="24" />
        <circle cx="160" cy="65" r="20" />
        <circle cx="0" cy="95" r="36" />
        <circle cx="35" cy="100" r="32" />
        <circle cx="75" cy="105" r="26" />
        <circle cx="120" cy="108" r="22" />
        <circle cx="165" cy="110" r="18" />
        <circle cx="0" cy="145" r="32" />
        <circle cx="40" cy="150" r="28" />
        <circle cx="85" cy="152" r="24" />
        <circle cx="130" cy="152" r="20" />
        <circle cx="175" cy="150" r="16" />
        <circle cx="0" cy="195" r="26" />
        <circle cx="45" cy="198" r="24" />
        <circle cx="95" cy="195" r="20" />
        <circle cx="145" cy="190" r="16" />
        <circle cx="0" cy="245" r="22" />
        <circle cx="50" cy="242" r="18" />
        <circle cx="105" cy="235" r="15" />
        <circle cx="195" cy="30" r="16" opacity="0.9" />
        <circle cx="230" cy="40" r="12" opacity="0.8" />
        <circle cx="265" cy="55" r="9" opacity="0.7" />
        <circle cx="295" cy="70" r="7" opacity="0.6" />
        <circle cx="320" cy="85" r="5" opacity="0.5" />
        <circle cx="205" cy="75" r="14" opacity="0.9" />
        <circle cx="245" cy="90" r="10" opacity="0.8" />
        <circle cx="280" cy="110" r="8" opacity="0.7" />
        <circle cx="310" cy="130" r="6" opacity="0.6" />
        <circle cx="215" cy="125" r="12" opacity="0.85" />
        <circle cx="255" cy="145" r="9" opacity="0.75" />
        <circle cx="290" cy="165" r="7" opacity="0.6" />
        <circle cx="220" cy="175" r="11" opacity="0.8" />
        <circle cx="260" cy="195" r="8" opacity="0.7" />
        <circle cx="190" cy="215" r="12" opacity="0.8" />
        <circle cx="230" cy="230" r="8" opacity="0.65" />
        <circle cx="155" cy="255" r="11" opacity="0.75" />
        <circle cx="195" cy="265" r="7" opacity="0.6" />
        <circle cx="110" cy="285" r="10" opacity="0.7" />
        <circle cx="65" cy="295" r="12" opacity="0.75" />
        <circle cx="20" cy="305" r="14" opacity="0.8" />
        <circle cx="240" cy="65" r="5" opacity="0.6" />
        <circle cx="275" cy="85" r="4" opacity="0.5" />
        <circle cx="225" cy="150" r="6" opacity="0.6" />
        <circle cx="270" cy="130" r="5" opacity="0.5" />
        <circle cx="175" cy="180" r="7" opacity="0.7" />
        <circle cx="140" cy="225" r="6" opacity="0.6" />
        <circle cx="170" cy="240" r="5" opacity="0.55" />
        <circle cx="85" cy="265" r="6" opacity="0.6" />
        <circle cx="700" cy="0" r="48" />
        <circle cx="665" cy="10" r="38" />
        <circle cx="625" cy="15" r="30" />
        <circle cx="585" cy="20" r="26" />
        <circle cx="545" cy="25" r="22" />
        <circle cx="700" cy="45" r="42" />
        <circle cx="665" cy="55" r="34" />
        <circle cx="625" cy="58" r="28" />
        <circle cx="585" cy="62" r="24" />
        <circle cx="540" cy="65" r="20" />
        <circle cx="700" cy="95" r="36" />
        <circle cx="665" cy="100" r="32" />
        <circle cx="625" cy="105" r="26" />
        <circle cx="580" cy="108" r="22" />
        <circle cx="535" cy="110" r="18" />
        <circle cx="700" cy="145" r="32" />
        <circle cx="660" cy="150" r="28" />
        <circle cx="615" cy="152" r="24" />
        <circle cx="570" cy="152" r="20" />
        <circle cx="525" cy="150" r="16" />
        <circle cx="700" cy="195" r="26" />
        <circle cx="655" cy="198" r="24" />
        <circle cx="605" cy="195" r="20" />
        <circle cx="555" cy="190" r="16" />
        <circle cx="700" cy="245" r="22" />
        <circle cx="650" cy="242" r="18" />
        <circle cx="595" cy="235" r="15" />
        <circle cx="505" cy="30" r="16" opacity="0.9" />
        <circle cx="470" cy="40" r="12" opacity="0.8" />
        <circle cx="435" cy="55" r="9" opacity="0.7" />
        <circle cx="405" cy="70" r="7" opacity="0.6" />
        <circle cx="380" cy="85" r="5" opacity="0.5" />
        <circle cx="495" cy="75" r="14" opacity="0.9" />
        <circle cx="455" cy="90" r="10" opacity="0.8" />
        <circle cx="420" cy="110" r="8" opacity="0.7" />
        <circle cx="390" cy="130" r="6" opacity="0.6" />
        <circle cx="485" cy="125" r="12" opacity="0.85" />
        <circle cx="445" cy="145" r="9" opacity="0.75" />
        <circle cx="410" cy="165" r="7" opacity="0.6" />
        <circle cx="480" cy="175" r="11" opacity="0.8" />
        <circle cx="440" cy="195" r="8" opacity="0.7" />
        <circle cx="510" cy="215" r="12" opacity="0.8" />
        <circle cx="470" cy="230" r="8" opacity="0.65" />
        <circle cx="545" cy="255" r="11" opacity="0.75" />
        <circle cx="505" cy="265" r="7" opacity="0.6" />
        <circle cx="590" cy="285" r="10" opacity="0.7" />
        <circle cx="635" cy="295" r="12" opacity="0.75" />
        <circle cx="680" cy="305" r="14" opacity="0.8" />
        <circle cx="460" cy="65" r="5" opacity="0.6" />
        <circle cx="425" cy="85" r="4" opacity="0.5" />
        <circle cx="475" cy="150" r="6" opacity="0.6" />
        <circle cx="430" cy="130" r="5" opacity="0.5" />
        <circle cx="525" cy="180" r="7" opacity="0.7" />
        <circle cx="560" cy="225" r="6" opacity="0.6" />
        <circle cx="530" cy="240" r="5" opacity="0.55" />
        <circle cx="615" cy="265" r="6" opacity="0.6" />
        <circle cx="40" cy="680" r="40" opacity="0.95" />
        <circle cx="100" cy="675" r="36" opacity="0.95" />
        <circle cx="170" cy="680" r="34" opacity="0.95" />
        <circle cx="245" cy="675" r="36" opacity="0.95" />
        <circle cx="320" cy="680" r="32" opacity="0.95" />
        <circle cx="390" cy="675" r="34" opacity="0.95" />
        <circle cx="460" cy="680" r="32" opacity="0.95" />
        <circle cx="530" cy="675" r="36" opacity="0.95" />
        <circle cx="600" cy="680" r="34" opacity="0.95" />
        <circle cx="660" cy="675" r="38" opacity="0.95" />
        <circle cx="70" cy="630" r="26" opacity="0.9" />
        <circle cx="135" cy="635" r="24" opacity="0.9" />
        <circle cx="205" cy="630" r="22" opacity="0.85" />
        <circle cx="280" cy="638" r="25" opacity="0.88" />
        <circle cx="355" cy="632" r="22" opacity="0.85" />
        <circle cx="425" cy="635" r="24" opacity="0.88" />
        <circle cx="495" cy="630" r="22" opacity="0.85" />
        <circle cx="565" cy="635" r="25" opacity="0.9" />
        <circle cx="630" cy="630" r="26" opacity="0.9" />
        <circle cx="40" cy="585" r="18" opacity="0.8" />
        <circle cx="105" cy="590" r="16" opacity="0.8" />
        <circle cx="175" cy="585" r="14" opacity="0.75" />
        <circle cx="250" cy="595" r="15" opacity="0.75" />
        <circle cx="325" cy="590" r="13" opacity="0.7" />
        <circle cx="395" cy="595" r="14" opacity="0.7" />
        <circle cx="465" cy="590" r="13" opacity="0.7" />
        <circle cx="535" cy="595" r="15" opacity="0.75" />
        <circle cx="600" cy="590" r="16" opacity="0.8" />
        <circle cx="660" cy="585" r="18" opacity="0.8" />
        <circle cx="75" cy="550" r="11" opacity="0.65" />
        <circle cx="145" cy="555" r="9" opacity="0.6" />
        <circle cx="220" cy="550" r="8" opacity="0.55" />
        <circle cx="360" cy="555" r="8" opacity="0.55" />
        <circle cx="480" cy="550" r="8" opacity="0.55" />
        <circle cx="560" cy="555" r="9" opacity="0.6" />
        <circle cx="625" cy="550" r="11" opacity="0.65" />
        <circle cx="40" cy="520" r="7" opacity="0.5" />
        <circle cx="660" cy="520" r="7" opacity="0.5" />
        <polygon points="38,542 46,550 38,558 30,550" opacity="0.75" />
        <polygon points="662,537 670,545 662,553 654,545" opacity="0.75" />
        <polygon points="240,109 246,115 240,121 234,115" opacity="0.65" />
        <polygon points="460,109 466,115 460,121 454,115" opacity="0.65" />
        <polygon points="185,273 192,280 185,287 178,280" opacity="0.6" />
        <polygon points="515,273 522,280 515,287 508,280" opacity="0.6" />
        <polygon points="300,564 306,570 300,576 294,570" opacity="0.55" />
        <polygon points="400,564 406,570 400,576 394,570" opacity="0.55" />
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

          {/* ROW 6: Two Medium Buttons (Retry & Next matching reference) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <button type="button" className="kit-btn kit-btn--md kit-btn--purple">
              <span className="kit-btn-label">Retry</span>
            </button>
            <button type="button" className="kit-btn kit-btn--md kit-btn--gold">
              <span className="kit-btn-label">Next</span>
            </button>
          </div>

          {/* ROW 7: Full-Width Large Gold Button */}
          <button type="button" className="kit-btn kit-btn--lg kit-btn--gold">
            <span className="kit-btn-label">Large button</span>
          </button>
        </div>
      </div>
    </div>
  );
}
