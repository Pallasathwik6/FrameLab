/**
 * FrameLab Virtual Studio - Interactive Face & Frame Visualizer
 * High-performance SVG & Canvas rendering for real-time eyewear preview
 */

export class VirtualStudio {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    
    // Internal state
    this.state = {
      faceShape: 'oval',
      skinTone: 'honey',
      frameShape: 'round',
      frameColor: '#111827',
      frameColorName: 'Matte Obsidian',
      lensTint: 'ar-blue',
      frameScale: 1.0,
      bridgeYOffset: 0,
      showGuides: false
    };

    // Skin tones palette
    this.skinPalettes = {
      fair: { base: '#FDEEE4', shadow: '#F4D8C5', lip: '#E09F92', eye: '#3B82F6' },
      sand: { base: '#F3DFCB', shadow: '#E4C7AC', lip: '#CE8B7B', eye: '#4B382A' },
      honey: { base: '#DEAC80', shadow: '#C88F5D', lip: '#B46853', eye: '#312015' },
      bronze: { base: '#A76F46', shadow: '#8B542E', lip: '#8E4839', eye: '#25150C' },
      deep: { base: '#5C341F', shadow: '#442211', lip: '#6B3128', eye: '#190E08' }
    };

    // Lens tints
    this.lensTints = {
      'clear': { fill: 'rgba(255, 255, 255, 0.08)', reflex: 'rgba(255, 255, 255, 0.25)' },
      'ar-blue': { fill: 'rgba(56, 189, 248, 0.12)', reflex: 'rgba(56, 189, 248, 0.35)' },
      'amber': { fill: 'rgba(217, 119, 6, 0.22)', reflex: 'rgba(251, 191, 36, 0.35)' },
      'smoke': { fill: 'rgba(15, 23, 42, 0.35)', reflex: 'rgba(255, 255, 255, 0.2)' },
      'rose': { fill: 'rgba(244, 114, 182, 0.18)', reflex: 'rgba(251, 207, 232, 0.3)' }
    };

    this.init();
  }

  init() {
    this.render();
  }

  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.render();
  }

  loadProduct(product) {
    // Map product shape to studio shape
    let mappedShape = 'round';
    if (product.shape === 'square') mappedShape = 'square';
    else if (product.shape === 'aviator') mappedShape = 'aviator';
    else if (product.shape === 'cat-eye') mappedShape = 'cat-eye';
    else if (product.shape === 'geometric') mappedShape = 'geometric';
    else if (product.material === 'titanium' && product.name.includes('Rimless')) mappedShape = 'rimless';

    const defaultColorObj = product.colors && product.colors[0] ? product.colors[0] : { hex: '#111827', name: 'Matte' };

    this.setState({
      frameShape: mappedShape,
      frameColor: defaultColorObj.hex,
      frameColorName: defaultColorObj.name,
      frameScale: 1.0,
      bridgeYOffset: 0
    });
  }

  render() {
    if (!this.container) return;

    const { faceShape, skinTone, frameShape, frameColor, lensTint, frameScale, bridgeYOffset, showGuides } = this.state;
    const skin = this.skinPalettes[skinTone] || this.skinPalettes.honey;
    const tint = this.lensTints[lensTint] || this.lensTints['ar-blue'];

    // Generate Face SVG Path based on morphotype
    const facePath = this.getFacePath(faceShape);
    
    // Generate Glasses SVG Elements based on frameShape
    const glassesSvg = this.getGlassesSvg(frameShape, frameColor, tint, frameScale, bridgeYOffset);

    // Optical guide overlay
    const guidesSvg = showGuides ? `
      <!-- Optical Center & Pupillary Distance Guides -->
      <g class="studio-guides" stroke="#0284C7" stroke-width="1.2" stroke-dasharray="3,3" opacity="0.8">
        <!-- Vertical Midline -->
        <line x1="200" y1="40" x2="200" y2="400" />
        <!-- Horizontal Pupil Datum Line -->
        <line x1="60" y1="${200 + bridgeYOffset}" x2="340" y2="${200 + bridgeYOffset}" />
        <!-- Pupil Center Crosshairs -->
        <circle cx="155" cy="${200 + bridgeYOffset}" r="8" fill="none" />
        <circle cx="245" cy="${200 + bridgeYOffset}" r="8" fill="none" />
        <line x1="155" y1="${188 + bridgeYOffset}" x2="155" y2="${212 + bridgeYOffset}" />
        <line x1="245" y1="${188 + bridgeYOffset}" x2="245" y2="${212 + bridgeYOffset}" />
        <text x="200" y="${180 + bridgeYOffset}" fill="#0284C7" font-size="10" font-family="'Fira Code', monospace" text-anchor="middle" font-weight="600">PD: 63.5 mm</text>
      </g>
    ` : '';

    this.container.innerHTML = `
      <svg viewBox="0 0 400 440" width="100%" height="100%" class="virtual-face-svg" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <!-- Lens Glare Gradient -->
          <linearGradient id="lensReflectionGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${tint.reflex}" stop-opacity="0.8" />
            <stop offset="30%" stop-color="${tint.reflex}" stop-opacity="0.1" />
            <stop offset="70%" stop-color="rgba(255,255,255,0.0)" stop-opacity="0" />
            <stop offset="100%" stop-color="${tint.reflex}" stop-opacity="0.4" />
          </linearGradient>

          <!-- Shadow Filter -->
          <filter id="frameDropShadow" x="-10%" y="-10%" width="125%" height="125%">
            <feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="rgba(11, 19, 37, 0.28)" />
          </filter>
        </defs>

        <!-- Background Studio Aura -->
        <rect width="400" height="440" fill="transparent" />
        <circle cx="200" cy="210" r="170" fill="rgba(244, 239, 234, 0.4)" />

        <!-- Neck and Shoulders -->
        <path d="M140 310 L140 440 L260 440 L260 310 Z" fill="${skin.shadow}" />
        <path d="M120 400 C150 360, 250 360, 280 400 L360 440 L40 440 Z" fill="#0B1325" />
        
        <!-- Ears -->
        <ellipse cx="106" cy="210" rx="14" ry="24" fill="${skin.shadow}" />
        <ellipse cx="294" cy="210" rx="14" ry="24" fill="${skin.shadow}" />
        <ellipse cx="108" cy="210" rx="8" ry="16" fill="${skin.base}" />
        <ellipse cx="292" cy="210" rx="8" ry="16" fill="${skin.base}" />

        <!-- Hair Base Silhouette (Behind Face) -->
        <path d="M96 200 C80 120, 140 45, 200 45 C260 45, 320 120, 304 200 C315 250, 300 310, 280 320 C240 290, 160 290, 120 320 C100 310, 85 250, 96 200 Z" fill="#1C1917" />

        <!-- Face Shape Contour -->
        <path d="${facePath}" fill="${skin.base}" stroke="${skin.shadow}" stroke-width="2" />

        <!-- Subtle Facial Cheeks / Blush -->
        <ellipse cx="140" cy="240" rx="24" ry="14" fill="${skin.lip}" opacity="0.12" />
        <ellipse cx="260" cy="240" rx="24" ry="14" fill="${skin.lip}" opacity="0.12" />

        <!-- Eyebrows -->
        <path d="M130 168 C145 160, 165 162, 175 168" stroke="#1C1917" stroke-width="3.5" stroke-linecap="round" fill="none" />
        <path d="M270 168 C255 160, 235 162, 225 168" stroke="#1C1917" stroke-width="3.5" stroke-linecap="round" fill="none" />

        <!-- Eyes (Sclera & Iris) -->
        <!-- Right Eye (Screen Left) -->
        <ellipse cx="155" cy="200" rx="17" ry="10" fill="#FFFFFF" />
        <ellipse cx="155" cy="200" rx="8" ry="8" fill="${skin.eye}" />
        <circle cx="155" cy="200" r="3.5" fill="#0F172A" />
        <circle cx="153" cy="198" r="1.5" fill="#FFFFFF" />
        <path d="M138 198 C145 190, 165 190, 172 198" stroke="#0F172A" stroke-width="2" stroke-linecap="round" fill="none" />

        <!-- Left Eye (Screen Right) -->
        <ellipse cx="245" cy="200" rx="17" ry="10" fill="#FFFFFF" />
        <ellipse cx="245" cy="200" rx="8" ry="8" fill="${skin.eye}" />
        <circle cx="245" cy="200" r="3.5" fill="#0F172A" />
        <circle cx="243" cy="198" r="1.5" fill="#FFFFFF" />
        <path d="M228 198 C235 190, 255 190, 262 198" stroke="#0F172A" stroke-width="2" stroke-linecap="round" fill="none" />

        <!-- Nose -->
        <path d="M197 195 L195 242 C195 247, 205 247, 205 242 L203 195" fill="none" stroke="${skin.shadow}" stroke-width="1.8" stroke-linecap="round" />
        <path d="M192 245 C197 250, 203 250, 208 245" fill="none" stroke="${skin.shadow}" stroke-width="2.2" stroke-linecap="round" />

        <!-- Lips -->
        <path d="M178 285 C190 280, 200 282, 200 282 C200 282, 210 280, 222 285 C212 296, 188 296, 178 285 Z" fill="${skin.lip}" opacity="0.9" />
        <path d="M180 285 C192 288, 208 288, 220 285" fill="none" stroke="#68291F" stroke-width="1.2" opacity="0.6" />

        <!-- Stylish Hair Front Overhang -->
        <path d="M100 130 C130 70, 270 70, 300 130 C270 100, 210 95, 180 115 C150 95, 120 105, 100 130 Z" fill="#1C1917" />

        <!-- Interactive Eyewear Frame Overlay -->
        <g id="interactiveGlassesGroup" filter="url(#frameDropShadow)">
          ${glassesSvg}
        </g>

        <!-- Measurement & Symmetry Guides -->
        ${guidesSvg}
      </svg>
    `;
  }

  getFacePath(faceShape) {
    switch (faceShape) {
      case 'round':
        // Fuller cheek curves, softer circular jaw
        return 'M120 160 C100 220, 110 300, 160 330 C185 342, 215 342, 240 330 C290 300, 300 220, 280 160 C265 100, 135 100, 120 160 Z';
      
      case 'square':
        // Stronger jawline angles and wide chin
        return 'M120 150 C110 200, 115 270, 135 315 C155 335, 245 335, 265 315 C285 270, 290 200, 280 150 C260 105, 140 105, 120 150 Z';
      
      case 'heart':
        // Wider forehead tapering smoothly to a slender, pointed chin
        return 'M115 145 C105 190, 125 260, 165 310 C185 335, 215 335, 235 310 C275 260, 295 190, 285 145 C265 100, 135 100, 115 145 Z';
      
      case 'diamond':
        // Narrow forehead and chin with wide, prominent cheekbones
        return 'M140 130 C100 190, 105 240, 150 315 C175 340, 225 340, 250 315 C295 240, 300 190, 260 130 C225 95, 175 95, 140 130 Z';
      
      case 'oval':
      default:
        // Balanced classic oval proportions
        return 'M120 150 C110 210, 120 280, 160 325 C180 340, 220 340, 240 325 C280 280, 290 210, 280 150 C265 100, 135 100, 120 150 Z';
    }
  }

  getGlassesSvg(frameShape, color, tint, scale, yOffset) {
    const cy = 200 + yOffset;
    const isTransparent = color.toLowerCase().includes('clear') || color === '#E5E7EB' || color === '#F3F4F6';
    const frameStroke = isTransparent ? 'rgba(255, 255, 255, 0.85)' : color;
    const frameFill = isTransparent ? 'rgba(255, 255, 255, 0.28)' : 'none';
    const strokeWidth = isTransparent ? 4.5 : (frameShape === 'rimless' ? 1.5 : (frameShape === 'square' ? 4.8 : 3.8));

    // Transform for scale
    const transform = `transform="translate(${200 * (1 - scale)}, ${cy * (1 - scale)}) scale(${scale})"`;

    // Nose Bridge SVG
    const bridgeSvg = `
      <path d="M185 ${cy - 2} C192 ${cy - 12}, 208 ${cy - 12}, 215 ${cy - 2}" 
            fill="none" stroke="${frameStroke}" stroke-width="${strokeWidth * 0.8}" stroke-linecap="round" />
    `;

    // Temples / Endpieces SVG
    const templesSvg = `
      <path d="M112 ${cy - 4} L90 ${cy - 16}" fill="none" stroke="${frameStroke}" stroke-width="${strokeWidth * 0.7}" stroke-linecap="round" />
      <path d="M288 ${cy - 4} L310 ${cy - 16}" fill="none" stroke="${frameStroke}" stroke-width="${strokeWidth * 0.7}" stroke-linecap="round" />
    `;

    let lensesSvg = '';

    switch (frameShape) {
      case 'square':
        // Tailored Rounded Square
        lensesSvg = `
          <!-- Right Lens -->
          <rect x="114" y="${cy - 28}" width="72" height="56" rx="10" 
                fill="${tint.fill}" stroke="${frameStroke}" stroke-width="${strokeWidth}" />
          <rect x="117" y="${cy - 25}" width="66" height="50" rx="8" 
                fill="url(#lensReflectionGrad)" stroke="none" />

          <!-- Left Lens -->
          <rect x="214" y="${cy - 28}" width="72" height="56" rx="10" 
                fill="${tint.fill}" stroke="${frameStroke}" stroke-width="${strokeWidth}" />
          <rect x="217" y="${cy - 25}" width="66" height="50" rx="8" 
                fill="url(#lensReflectionGrad)" stroke="none" />
        `;
        break;

      case 'aviator':
        // Navigator Teardrop / Double Bridge
        lensesSvg = `
          <!-- Top Brow Bar -->
          <line x1="125" y1="${cy - 26}" x2="275" y2="${cy - 26}" stroke="${frameStroke}" stroke-width="${strokeWidth * 0.6}" stroke-linecap="round" />

          <!-- Right Lens -->
          <path d="M120 ${cy - 24} L182 ${cy - 24} C188 ${cy - 24}, 190 ${cy - 15}, 188 ${cy + 10} C184 ${cy + 30}, 160 ${cy + 36}, 135 ${cy + 32} C118 ${cy + 28}, 114 ${cy + 10}, 115 ${cy - 15} Z" 
                fill="${tint.fill}" stroke="${frameStroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />
          <path d="M123 ${cy - 21} L179 ${cy - 21} C185 ${cy - 21}, 187 ${cy - 13}, 185 ${cy + 8} C181 ${cy + 27}, 159 ${cy + 33}, 136 ${cy + 29} C120 ${cy + 25}, 117 ${cy + 9}, 118 ${cy - 13} Z" 
                fill="url(#lensReflectionGrad)" stroke="none" />

          <!-- Left Lens -->
          <path d="M280 ${cy - 24} L218 ${cy - 24} C212 ${cy - 24}, 210 ${cy - 15}, 212 ${cy + 10} C216 ${cy + 30}, 240 ${cy + 36}, 265 ${cy + 32} C282 ${cy + 28}, 286 ${cy + 10}, 285 ${cy - 15} Z" 
                fill="${tint.fill}" stroke="${frameStroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />
          <path d="M277 ${cy - 21} L221 ${cy - 21} C215 ${cy - 21}, 213 ${cy - 13}, 215 ${cy + 8} C219 ${cy + 27}, 241 ${cy + 33}, 264 ${cy + 29} C280 ${cy + 25}, 283 ${cy + 9}, 282 ${cy - 13} Z" 
                fill="url(#lensReflectionGrad)" stroke="none" />
        `;
        break;

      case 'cat-eye':
        // Modern Sculpted Winged Cat-Eye
        lensesSvg = `
          <!-- Right Lens -->
          <path d="M112 ${cy - 30} C140 ${cy - 28}, 175 ${cy - 20}, 184 ${cy - 10} C188 ${cy + 15}, 165 ${cy + 30}, 145 ${cy + 28} C120 ${cy + 26}, 110 ${cy + 10}, 112 ${cy - 30} Z" 
                fill="${tint.fill}" stroke="${frameStroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />
          <path d="M115 ${cy - 27} C139 ${cy - 25}, 172 ${cy - 18}, 181 ${cy - 8} C185 ${cy + 13}, 163 ${cy + 27}, 145 ${cy + 25} C122 ${cy + 23}, 113 ${cy + 8}, 115 ${cy - 27} Z" 
                fill="url(#lensReflectionGrad)" stroke="none" />

          <!-- Left Lens -->
          <path d="M288 ${cy - 30} C260 ${cy - 28}, 225 ${cy - 20}, 216 ${cy - 10} C212 ${cy + 15}, 235 ${cy + 30}, 255 ${cy + 28} C280 ${cy + 26}, 290 ${cy + 10}, 288 ${cy - 30} Z" 
                fill="${tint.fill}" stroke="${frameStroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />
          <path d="M285 ${cy - 27} C261 ${cy - 25}, 228 ${cy - 18}, 219 ${cy - 8} C215 ${cy + 13}, 237 ${cy + 27}, 255 ${cy + 25} C278 ${cy + 23}, 287 ${cy + 8}, 285 ${cy - 27} Z" 
                fill="url(#lensReflectionGrad)" stroke="none" />
        `;
        break;

      case 'geometric':
        // Hexagonal Architectural
        lensesSvg = `
          <!-- Right Lens -->
          <polygon points="120,${cy-22} 175,${cy-22} 188,${cy} 175,${cy+26} 125,${cy+26} 112,${cy}" 
                   fill="${tint.fill}" stroke="${frameStroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />
          <polygon points="123,${cy-19} 172,${cy-19} 185,${cy} 172,${cy+23} 127,${cy+23} 115,${cy}" 
                   fill="url(#lensReflectionGrad)" stroke="none" />

          <!-- Left Lens -->
          <polygon points="225,${cy-22} 280,${cy-22} 288,${cy} 275,${cy+26} 225,${cy+26} 212,${cy}" 
                   fill="${tint.fill}" stroke="${frameStroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />
          <polygon points="228,${cy-19} 277,${cy-19} 285,${cy} 272,${cy+23} 228,${cy+23} 215,${cy}" 
                   fill="url(#lensReflectionGrad)" stroke="none" />
        `;
        break;

      case 'rimless':
        // Frameless Drill Mount (Refined screws, subtle edge bevel)
        lensesSvg = `
          <!-- Right Lens Bevel -->
          <ellipse cx="152" cy="${cy}" rx="36" ry="28" fill="${tint.fill}" stroke="rgba(255, 255, 255, 0.45)" stroke-width="1.2" />
          <ellipse cx="152" cy="${cy}" rx="33" ry="25" fill="url(#lensReflectionGrad)" />
          <!-- Drill mount pins -->
          <circle cx="184" cy="${cy - 2}" r="1.8" fill="${frameStroke}" />
          <circle cx="119" cy="${cy - 4}" r="1.8" fill="${frameStroke}" />

          <!-- Left Lens Bevel -->
          <ellipse cx="248" cy="${cy}" rx="36" ry="28" fill="${tint.fill}" stroke="rgba(255, 255, 255, 0.45)" stroke-width="1.2" />
          <ellipse cx="248" cy="${cy}" rx="33" ry="25" fill="url(#lensReflectionGrad)" />
          <!-- Drill mount pins -->
          <circle cx="216" cy="${cy - 2}" r="1.8" fill="${frameStroke}" />
          <circle cx="281" cy="${cy - 4}" r="1.8" fill="${frameStroke}" />
        `;
        break;

      case 'round':
      default:
        // Panto / Rounded Circumference
        lensesSvg = `
          <!-- Right Lens -->
          <ellipse cx="152" cy="${cy}" rx="36" ry="32" 
                   fill="${tint.fill}" stroke="${frameStroke}" stroke-width="${strokeWidth}" />
          <ellipse cx="152" cy="${cy}" rx="33" ry="29" 
                   fill="url(#lensReflectionGrad)" stroke="none" />

          <!-- Left Lens -->
          <ellipse cx="248" cy="${cy}" rx="36" ry="32" 
                   fill="${tint.fill}" stroke="${frameStroke}" stroke-width="${strokeWidth}" />
          <ellipse cx="248" cy="${cy}" rx="33" ry="29" 
                   fill="url(#lensReflectionGrad)" stroke="none" />
        `;
        break;
    }

    return `
      <g ${transform}>
        ${bridgeSvg}
        ${templesSvg}
        ${lensesSvg}
      </g>
    `;
  }
}
