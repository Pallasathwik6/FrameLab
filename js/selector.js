/**
 * FrameLab Smart Multi-Step Frame Selector Engine
 * Biometric matching heuristic based on facial symmetry, style, material and budget
 */

import { PRODUCTS, FACE_SHAPES_DATA } from './products.js';

export class FrameSelector {
  constructor(options = {}) {
    this.currentStep = 1;
    this.totalSteps = 4;
    
    this.selections = {
      faceShape: null,
      style: null,
      material: null,
      budget: null
    };

    this.onComplete = options.onComplete || (() => {});
    this.onStepChange = options.onStepChange || (() => {});

    this.initDOM();
  }

  initDOM() {
    this.progressBar = document.getElementById('selectorProgressBar');
    this.stepIndicator = document.getElementById('selectorStepIndicator');
    this.stepContainers = document.querySelectorAll('.selector-step-card');
    
    this.btnPrev = document.getElementById('btnSelectorPrev');
    this.btnNext = document.getElementById('btnSelectorNext');
    this.btnReset = document.getElementById('btnSelectorReset');

    this.bindEvents();
    this.updateUI();
  }

  bindEvents() {
    // Option Cards Selection
    document.querySelectorAll('.selector-option-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const step = parseInt(btn.getAttribute('data-step'), 10);
        const value = btn.getAttribute('data-value');
        const category = btn.getAttribute('data-category');

        // Remove active class from sibling buttons in this step
        const parent = btn.closest('.selector-options-grid');
        parent.querySelectorAll('.selector-option-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
        });

        // Set active on clicked button
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');

        // Store selection
        this.selections[category] = value;

        // Auto-enable next or auto-advance after small tactile delay
        this.updateButtons();
      });
    });

    if (this.btnPrev) {
      this.btnPrev.addEventListener('click', () => this.prevStep());
    }

    if (this.btnNext) {
      this.btnNext.addEventListener('click', () => this.nextStep());
    }

    if (this.btnReset) {
      this.btnReset.addEventListener('click', () => this.reset());
    }
  }

  setStep(step) {
    if (step < 1 || step > this.totalSteps) return;
    this.currentStep = step;
    this.updateUI();
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.setStep(this.currentStep - 1);
    }
  }

  nextStep() {
    const currentCategory = this.getCategoryForStep(this.currentStep);
    if (!this.selections[currentCategory]) {
      // Shake or highlight requirement
      const currentContainer = document.querySelector(`.selector-step-card[data-step="${this.currentStep}"]`);
      if (currentContainer) {
        currentContainer.classList.add('shake-feedback');
        setTimeout(() => currentContainer.classList.remove('shake-feedback'), 500);
      }
      return;
    }

    if (this.currentStep < this.totalSteps) {
      this.setStep(this.currentStep + 1);
    } else {
      // Completed all steps!
      this.computeRecommendations();
    }
  }

  getCategoryForStep(step) {
    switch (step) {
      case 1: return 'faceShape';
      case 2: return 'style';
      case 3: return 'material';
      case 4: return 'budget';
      default: return '';
    }
  }

  updateUI() {
    // 1. Update Step Card Visibility
    this.stepContainers.forEach(container => {
      const step = parseInt(container.getAttribute('data-step'), 10);
      if (step === this.currentStep) {
        container.classList.add('active');
      } else {
        container.classList.remove('active');
      }
    });

    // 2. Update Progress Bar
    const progressPercent = ((this.currentStep - 1) / (this.totalSteps - 1)) * 100;
    if (this.progressBar) {
      this.progressBar.style.width = `${Math.max(12, progressPercent)}%`;
    }

    // 3. Update Step Indicator
    if (this.stepIndicator) {
      this.stepIndicator.textContent = `Step ${this.currentStep} of ${this.totalSteps}`;
    }

    this.updateButtons();
    this.onStepChange(this.currentStep, this.selections);
  }

  updateButtons() {
    const currentCategory = this.getCategoryForStep(this.currentStep);
    const hasSelection = Boolean(this.selections[currentCategory]);

    if (this.btnPrev) {
      this.btnPrev.disabled = this.currentStep === 1;
      this.btnPrev.style.opacity = this.currentStep === 1 ? '0.4' : '1';
    }

    if (this.btnNext) {
      if (this.currentStep === this.totalSteps) {
        this.btnNext.innerHTML = `
          <span>View My Recommended Frames</span>
          <svg class="btn-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        `;
      } else {
        this.btnNext.innerHTML = `
          <span>Continue</span>
          <svg class="btn-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
          </svg>
        `;
      }
      this.btnNext.disabled = !hasSelection;
      this.btnNext.style.opacity = hasSelection ? '1' : '0.5';
    }
  }

  reset() {
    this.currentStep = 1;
    this.selections = {
      faceShape: null,
      style: null,
      material: null,
      budget: null
    };

    document.querySelectorAll('.selector-option-btn').forEach(btn => {
      btn.classList.remove('active');
      btn.setAttribute('aria-checked', 'false');
    });

    this.updateUI();

    // Hide recommendation panel if shown
    const resultsPanel = document.getElementById('selectorResultsSection');
    if (resultsPanel) {
      resultsPanel.classList.add('hidden');
    }
  }

  isBudgetMatch(price, budgetKey) {
    switch (budgetKey) {
      case 'under-2000':
        return price < 2000;
      case '2000-4000':
        return price >= 2000 && price <= 4000;
      case '4000-7000':
        return price > 4000 && price <= 7000;
      case 'above-7000':
        return price > 7000;
      default:
        return true;
    }
  }

  computeRecommendations() {
    const { faceShape, style, material, budget } = this.selections;

    const scoredProducts = PRODUCTS.map(product => {
      let score = 45; // baseline
      const reasons = [];

      // 1. Face Shape Harmony
      if (faceShape && product.suitableFaceShapes.includes(faceShape)) {
        score += 30;
        reasons.push(`Flattering contrast for your ${faceShape.toUpperCase()} face shape`);
      } else {
        score -= 10;
      }

      // 2. Personal Style
      if (style && product.style === style) {
        score += 15;
        reasons.push(`Aligns with your ${product.styleName} aesthetic`);
      }

      // 3. Material Match
      if (material && product.material === material) {
        score += 15;
        reasons.push(`Crafted in your preferred ${product.materialName}`);
      }

      // 4. Budget Match
      if (budget && this.isBudgetMatch(product.price, budget)) {
        score += 12;
      } else if (budget) {
        score -= 8;
      }

      // Clamp between 48% and 99%
      const finalScore = Math.min(99, Math.max(48, Math.round(score)));

      return {
        product,
        matchScore: finalScore,
        reasons: reasons.slice(0, 2)
      };
    });

    // Sort descending by matchScore
    scoredProducts.sort((a, b) => b.matchScore - a.matchScore);

    // Pick top 4-6 recommended frames
    const recommendations = scoredProducts.slice(0, 4);

    this.onComplete({
      selections: this.selections,
      recommendations,
      faceShapeInfo: FACE_SHAPES_DATA[faceShape] || null
    });
  }
}
