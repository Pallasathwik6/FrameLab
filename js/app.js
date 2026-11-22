/**
 * FrameLab Luxury Eyewear - Main Application Controller
 * Handles Catalog, Filtering, Search, Virtual Studio, Favorites & Cart with LocalStorage
 */

import { PRODUCTS, FACE_SHAPES_DATA } from './products.js';
import { FrameSelector } from './selector.js';
import { VirtualStudio } from './virtual-studio.js';

class FrameLabApp {
  constructor() {
    this.products = [...PRODUCTS];
    this.favorites = this.loadFavorites();
    this.cart = this.loadCart();
    
    // Filter State
    this.filters = {
      search: '',
      material: 'all',
      faceShape: 'all',
      style: 'all',
      budget: 'all',
      sortBy: 'featured'
    };

    // Active preview color map: { productId: colorIndex }
    this.activeColors = {};

    this.init();
  }

  init() {
    // 1. Initialize Virtual Studio
    this.studio = new VirtualStudio('virtualFaceContainer');

    // 2. Initialize Smart Frame Selector
    this.selector = new FrameSelector({
      onComplete: (data) => this.handleSelectorCompletion(data),
      onStepChange: (step, selections) => {
        // Sync Virtual Studio face shape when step 1 face shape changes!
        if (selections.faceShape) {
          this.studio.setState({ faceShape: selections.faceShape });
        }
      }
    });

    // 3. Bind UI Events
    this.bindNavbar();
    this.bindFiltersAndSearch();
    this.bindStudioControls();
    this.bindDrawersAndModals();
    this.bindNewsletter();
    this.bindFAQ();
    this.initCheckout();
    this.initAmbientBackground();

    // 4. Initial Render
    this.renderCatalog();
    this.updateFavoritesCount();
    this.updateCartCount();
  }

  // ==================== LUXURY AMBIENT BACKGROUND TRACKER ====================
  initAmbientBackground() {
    const glow = document.getElementById('cursorAmbientGlow');
    if (!glow) return;

    let mouseX = -1000;
    let mouseY = -1000;
    let currentX = -1000;
    let currentY = -1000;
    let isTracking = false;

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!isTracking) {
        isTracking = true;
        glow.classList.add('active');
      }
    }, { passive: true });

    document.addEventListener('mouseleave', () => {
      glow.classList.remove('active');
      isTracking = false;
    });

    const updateGlow = () => {
      if (isTracking) {
        currentX += (mouseX - currentX) * 0.12;
        currentY += (mouseY - currentY) * 0.12;
        glow.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
      }
      requestAnimationFrame(updateGlow);
    };

    requestAnimationFrame(updateGlow);
  }

  // ==================== STORAGE HELPERS ====================
  loadFavorites() {
    try {
      const saved = localStorage.getItem('framelab_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.warn('LocalStorage error loading favorites:', e);
      return [];
    }
  }

  saveFavorites() {
    try {
      localStorage.setItem('framelab_favorites', JSON.stringify(this.favorites));
      this.updateFavoritesCount();
    } catch (e) {
      console.warn('LocalStorage error saving favorites:', e);
    }
  }

  loadCart() {
    try {
      const saved = localStorage.getItem('framelab_cart');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.warn('LocalStorage error loading cart:', e);
      return [];
    }
  }

  saveCart() {
    try {
      localStorage.setItem('framelab_cart', JSON.stringify(this.cart));
      this.updateCartCount();
      this.renderCartDrawer();
    } catch (e) {
      console.warn('LocalStorage error saving cart:', e);
    }
  }

  toggleFavorite(productId) {
    const index = this.favorites.indexOf(productId);
    const product = this.products.find(p => p.id === productId);

    if (index > -1) {
      this.favorites.splice(index, 1);
      this.showToast(`Removed "${product ? product.name : 'Frame'}" from saved favorites`, 'info');
    } else {
      this.favorites.push(productId);
      this.showToast(`Saved "${product ? product.name : 'Frame'}" to your favorites`, 'success');
    }

    this.saveFavorites();
    this.renderCatalog();
    this.renderFavoritesDrawer();
  }

  addToCart(productId, selectedColor = null) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    const color = selectedColor || product.defaultColor;
    const existing = this.cart.find(item => item.id === productId && item.color === color);

    if (existing) {
      existing.quantity += 1;
    } else {
      this.cart.push({
        id: productId,
        name: product.name,
        price: product.price,
        image: product.image,
        color: color,
        dimensions: product.dimensions,
        quantity: 1
      });
    }

    this.saveCart();
    this.showToast(`Added "${product.name}" (${color}) to your shopping bag`, 'success');
  }

  removeFromCart(index) {
    this.cart.splice(index, 1);
    this.saveCart();
  }

  updateCartQuantity(index, delta) {
    if (!this.cart[index]) return;
    this.cart[index].quantity += delta;
    if (this.cart[index].quantity <= 0) {
      this.removeFromCart(index);
    } else {
      this.saveCart();
    }
  }

  updateFavoritesCount() {
    const countEl = document.getElementById('navFavoritesCount');
    if (countEl) {
      countEl.textContent = this.favorites.length;
      countEl.style.display = this.favorites.length > 0 ? 'inline-flex' : 'none';
    }
  }

  updateCartCount() {
    const countEl = document.getElementById('navCartCount');
    const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    if (countEl) {
      countEl.textContent = totalItems;
      countEl.style.display = totalItems > 0 ? 'inline-flex' : 'none';
    }
  }

  // ==================== CATALOG RENDERING ====================
  renderCatalog() {
    const grid = document.getElementById('productsGrid');
    const countEl = document.getElementById('catalogProductsCount');
    if (!grid) return;

    // Filter products
    let filtered = this.products.filter(product => {
      // Search
      if (this.filters.search) {
        const q = this.filters.search.toLowerCase();
        const matchesName = product.name.toLowerCase().includes(q);
        const matchesMaterial = product.materialName.toLowerCase().includes(q);
        const matchesStyle = product.styleName.toLowerCase().includes(q);
        const matchesColor = product.colors.some(c => c.name.toLowerCase().includes(q));
        if (!matchesName && !matchesMaterial && !matchesStyle && !matchesColor) return false;
      }

      // Material
      if (this.filters.material !== 'all' && product.material !== this.filters.material) return false;

      // Face Shape
      if (this.filters.faceShape !== 'all' && !product.suitableFaceShapes.includes(this.filters.faceShape)) return false;

      // Style
      if (this.filters.style !== 'all' && product.style !== this.filters.style) return false;

      // Budget
      if (this.filters.budget !== 'all') {
        const p = product.price;
        if (this.filters.budget === 'under-2000' && p >= 2000) return false;
        if (this.filters.budget === '2000-4000' && (p < 2000 || p > 4000)) return false;
        if (this.filters.budget === '4000-7000' && (p < 4000 || p > 7000)) return false;
        if (this.filters.budget === 'above-7000' && p <= 7000) return false;
      }

      return true;
    });

    // Sort products
    switch (this.filters.sortBy) {
      case 'price-asc':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'rating-desc':
        filtered.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        filtered.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
        break;
      case 'featured':
      default:
        filtered.sort((a, b) => (b.isBestseller ? 1 : 0) - (a.isBestseller ? 1 : 0));
        break;
    }

    if (countEl) {
      countEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'Frame' : 'Frames'} Available`;
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-catalog-message">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <h3>No Frames Match Your Filter Criteria</h3>
          <p>Try resetting some filters or searching for materials like "Titanium" or "Acetate".</p>
          <button id="btnResetAllFilters" class="btn btn-secondary mt-3">Reset All Filters</button>
        </div>
      `;

      const resetBtn = document.getElementById('btnResetAllFilters');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => this.resetAllFilters());
      }
      return;
    }

    grid.innerHTML = filtered.map(product => {
      const isFav = this.favorites.includes(product.id);
      const activeColorIndex = this.activeColors[product.id] || 0;
      const activeColor = product.colors[activeColorIndex] || product.colors[0];
      const displayImage = activeColor.previewImage || product.image;
      const discountPercent = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);

      const colorSwatchesHtml = product.colors.map((c, i) => `
        <button type="button" 
                class="color-swatch-dot ${i === activeColorIndex ? 'active' : ''}" 
                style="background-color: ${c.hex};" 
                title="${c.name}"
                data-product-id="${product.id}"
                data-color-index="${i}"
                aria-label="Switch to ${c.name}">
        </button>
      `).join('');

      return `
        <article class="product-card" data-product-id="${product.id}">
          <div class="product-image-container">
            ${product.badge ? `<span class="product-badge">${product.badge}</span>` : ''}
            
            <button class="btn-favorite-heart ${isFav ? 'active' : ''}" 
                    data-product-id="${product.id}"
                    aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
              <svg viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </button>

            <img src="${displayImage}" 
                 alt="${product.name} in ${activeColor.name}" 
                 class="product-image" 
                 loading="lazy" 
                 onerror="this.onerror=null; this.src='assets/images/fallback-eyewear.svg';" />

            <div class="product-image-overlay">
              <button class="btn-quick-try btn-sm" data-try-id="${product.id}">
                <svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
                </svg>
                Try in Virtual Studio
              </button>
            </div>
          </div>

          <div class="product-content">
            <div class="product-meta-header">
              <span class="product-material-tag">${product.materialName}</span>
              <div class="product-rating">
                <span class="star-icon">★</span>
                <span class="rating-val">${product.rating}</span>
                <span class="reviews-count">(${product.reviewsCount})</span>
              </div>
            </div>

            <h3 class="product-title" data-quickview-id="${product.id}">${product.name}</h3>
            <p class="product-tagline">${product.tagline}</p>

            <div class="product-swatches-row">
              <div class="swatches-list">
                ${colorSwatchesHtml}
              </div>
              <span class="active-color-label">${activeColor.name}</span>
            </div>

            <div class="product-dimensions-pill">
              ISO: ${product.dimensions.lensWidth} □ ${product.dimensions.bridge} - ${product.dimensions.temple} mm
            </div>

            <div class="product-pricing-footer">
              <div class="pricing-block">
                <span class="currency-symbol">₹</span>
                <span class="current-price">${product.price.toLocaleString('en-IN')}</span>
                <span class="original-price">₹${product.originalPrice.toLocaleString('en-IN')}</span>
                <span class="discount-badge">${discountPercent}% OFF</span>
              </div>

              <div class="product-actions-group">
                <button class="btn btn-secondary btn-icon-only btn-quickview" data-quickview-id="${product.id}" title="Quick View Specs">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
                <button class="btn btn-primary btn-sm btn-add-bag" data-add-id="${product.id}">
                  Add to Bag
                </button>
              </div>
            </div>
          </div>
        </article>
      `;
    }).join('');

    this.bindProductCardEvents();
  }

  bindProductCardEvents() {
    // Favorite Hearts
    document.querySelectorAll('.btn-favorite-heart').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-product-id');
        this.toggleFavorite(id);
      });
    });

    // Color Swatches
    document.querySelectorAll('.color-swatch-dot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        const pid = dot.getAttribute('data-product-id');
        const cidx = parseInt(dot.getAttribute('data-color-index'), 10);
        this.activeColors[pid] = cidx;
        this.renderCatalog();
      });
    });

    // Quick Try in Studio
    document.querySelectorAll('.btn-quick-try').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pid = btn.getAttribute('data-try-id');
        const prod = this.products.find(p => p.id === pid);
        if (prod) {
          this.studio.loadProduct(prod);
          this.showToast(`Loaded "${prod.name}" in Virtual Studio`, 'info');
          const studioEl = document.getElementById('virtualStudioSection');
          if (studioEl) {
            studioEl.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    });

    // Quick View Modal
    document.querySelectorAll('[data-quickview-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        const pid = el.getAttribute('data-quickview-id');
        this.openQuickViewModal(pid);
      });
    });

    // Add to Bag
    document.querySelectorAll('.btn-add-bag').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pid = btn.getAttribute('data-add-id');
        const colorIdx = this.activeColors[pid] || 0;
        const prod = this.products.find(p => p.id === pid);
        const colorName = prod && prod.colors[colorIdx] ? prod.colors[colorIdx].name : null;
        this.addToCart(pid, colorName);
      });
    });
  }

  // ==================== FILTER & SEARCH BINDINGS ====================
  bindFiltersAndSearch() {
    // Search input
    const searchInput = document.getElementById('catalogSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.filters.search = searchInput.value.trim();
        this.renderCatalog();
      });
    }

    // Material filter
    const materialSelect = document.getElementById('filterMaterial');
    if (materialSelect) {
      materialSelect.addEventListener('change', () => {
        this.filters.material = materialSelect.value;
        this.renderCatalog();
      });
    }

    // Face shape filter
    const faceShapeSelect = document.getElementById('filterFaceShape');
    if (faceShapeSelect) {
      faceShapeSelect.addEventListener('change', () => {
        this.filters.faceShape = faceShapeSelect.value;
        this.renderCatalog();
      });
    }

    // Style filter
    const styleSelect = document.getElementById('filterStyle');
    if (styleSelect) {
      styleSelect.addEventListener('change', () => {
        this.filters.style = styleSelect.value;
        this.renderCatalog();
      });
    }

    // Budget filter
    const budgetSelect = document.getElementById('filterBudget');
    if (budgetSelect) {
      budgetSelect.addEventListener('change', () => {
        this.filters.budget = budgetSelect.value;
        this.renderCatalog();
      });
    }

    // Sort By
    const sortSelect = document.getElementById('catalogSortBy');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        this.filters.sortBy = sortSelect.value;
        this.renderCatalog();
      });
    }

    // Clear filters button
    const clearBtn = document.getElementById('btnResetFilters');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.resetAllFilters());
    }
  }

  resetAllFilters() {
    this.filters = {
      search: '',
      material: 'all',
      faceShape: 'all',
      style: 'all',
      budget: 'all',
      sortBy: 'featured'
    };

    const searchInput = document.getElementById('catalogSearchInput');
    if (searchInput) searchInput.value = '';

    const materialSelect = document.getElementById('filterMaterial');
    if (materialSelect) materialSelect.value = 'all';

    const faceShapeSelect = document.getElementById('filterFaceShape');
    if (faceShapeSelect) faceShapeSelect.value = 'all';

    const styleSelect = document.getElementById('filterStyle');
    if (styleSelect) styleSelect.value = 'all';

    const budgetSelect = document.getElementById('filterBudget');
    if (budgetSelect) budgetSelect.value = 'all';

    const sortSelect = document.getElementById('catalogSortBy');
    if (sortSelect) sortSelect.value = 'featured';

    this.renderCatalog();
    this.showToast('All filters have been reset', 'info');
  }

  // ==================== VIRTUAL STUDIO CONTROLS ====================
  bindStudioControls() {
    // Face Shape buttons
    document.querySelectorAll('.studio-face-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.studio-face-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.studio.setState({ faceShape: btn.getAttribute('data-shape') });
      });
    });

    // Skin Tone swatches
    document.querySelectorAll('.studio-skin-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        document.querySelectorAll('.studio-skin-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        this.studio.setState({ skinTone: dot.getAttribute('data-tone') });
      });
    });

    // Frame Shape selector
    const frameShapeSelect = document.getElementById('studioFrameShape');
    if (frameShapeSelect) {
      frameShapeSelect.addEventListener('change', () => {
        this.studio.setState({ frameShape: frameShapeSelect.value });
      });
    }

    // Frame Color swatches
    document.querySelectorAll('.studio-color-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        document.querySelectorAll('.studio-color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        this.studio.setState({
          frameColor: dot.getAttribute('data-color'),
          frameColorName: dot.getAttribute('title')
        });
      });
    });

    // Lens Tint options
    document.querySelectorAll('.studio-tint-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.studio-tint-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.studio.setState({ lensTint: btn.getAttribute('data-tint') });
      });
    });

    // Scale Slider
    const scaleSlider = document.getElementById('studioScaleSlider');
    const scaleVal = document.getElementById('studioScaleVal');
    if (scaleSlider) {
      scaleSlider.addEventListener('input', () => {
        const val = parseFloat(scaleSlider.value);
        if (scaleVal) scaleVal.textContent = `${Math.round(val * 100)}%`;
        this.studio.setState({ frameScale: val });
      });
    }

    // Bridge Y Slider
    const bridgeSlider = document.getElementById('studioBridgeSlider');
    if (bridgeSlider) {
      bridgeSlider.addEventListener('input', () => {
        this.studio.setState({ bridgeYOffset: parseInt(bridgeSlider.value, 10) });
      });
    }

    // Symmetry & Pupil Guides Toggle
    const guidesToggle = document.getElementById('studioGuidesToggle');
    if (guidesToggle) {
      guidesToggle.addEventListener('change', () => {
        this.studio.setState({ showGuides: guidesToggle.checked });
      });
    }

    // Button: Find This Silhouette in Catalog
    const findSilhouetteBtn = document.getElementById('btnStudioFindMatch');
    if (findSilhouetteBtn) {
      findSilhouetteBtn.addEventListener('click', () => {
        const shape = this.studio.state.frameShape;
        this.filters.faceShape = this.studio.state.faceShape;
        const catalogSec = document.getElementById('catalogSection');
        if (catalogSec) {
          catalogSec.scrollIntoView({ behavior: 'smooth' });
        }
        this.showToast(`Filtered collection for your ${this.studio.state.faceShape} face shape`, 'info');
      });
    }
  }

  // ==================== SELECTOR COMPLETION HANDLER ====================
  handleSelectorCompletion({ selections, recommendations, faceShapeInfo }) {
    const resultsSection = document.getElementById('selectorResultsSection');
    const recGrid = document.getElementById('selectorRecommendationsGrid');
    const adviceText = document.getElementById('selectorFaceAdvice');
    const faceTitle = document.getElementById('selectorFaceTitle');

    if (!resultsSection || !recGrid) return;

    if (faceShapeInfo) {
      if (faceTitle) faceTitle.textContent = `${faceShapeInfo.name} Face Geometry`;
      if (adviceText) adviceText.textContent = `${faceShapeInfo.description} ${faceShapeInfo.advice}`;
    }

    recGrid.innerHTML = recommendations.map(({ product, matchScore, reasons }) => {
      return `
        <div class="recommendation-card">
          <div class="rec-score-ribbon">${matchScore}% Match</div>
          <img src="${product.image}" onerror="this.onerror=null; this.src='assets/images/fallback-eyewear.svg';" alt="${product.name}" class="rec-img" />
          <div class="rec-info">
            <span class="rec-material">${product.materialName}</span>
            <h4 class="rec-title">${product.name}</h4>
            <div class="rec-price">₹${product.price.toLocaleString('en-IN')}</div>
            <ul class="rec-reasons-list">
              ${reasons.map(r => `<li>${r}</li>`).join('')}
            </ul>
            <div class="rec-actions">
              <button class="btn btn-secondary btn-sm btn-rec-studio" data-rec-id="${product.id}">
                Try in Studio
              </button>
              <button class="btn btn-primary btn-sm btn-rec-add" data-rec-id="${product.id}">
                Add to Bag
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Bind recommendation actions
    recGrid.querySelectorAll('.btn-rec-studio').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.getAttribute('data-rec-id');
        const prod = this.products.find(p => p.id === pid);
        if (prod) {
          this.studio.loadProduct(prod);
          const studioEl = document.getElementById('virtualStudioSection');
          if (studioEl) studioEl.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    recGrid.querySelectorAll('.btn-rec-add').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.getAttribute('data-rec-id');
        this.addToCart(pid);
      });
    });

    resultsSection.classList.remove('hidden');
    resultsSection.scrollIntoView({ behavior: 'smooth' });
    this.showToast('Generated personalized frame recommendations!', 'success');
  }

  // ==================== QUICK VIEW MODAL ====================
  openQuickViewModal(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    const modal = document.getElementById('quickViewModal');
    const container = document.getElementById('quickViewContainer');
    if (!modal || !container) return;

    const activeColorIndex = this.activeColors[product.id] || 0;
    const activeColor = product.colors[activeColorIndex] || product.colors[0];
    const isFav = this.favorites.includes(product.id);

    container.innerHTML = `
      <div class="modal-product-grid">
        <div class="modal-image-col">
          <div class="modal-main-image-wrapper">
            <img src="${activeColor.previewImage || product.image}" 
                 id="modalMainImg" 
                 onerror="this.onerror=null; this.src='assets/images/fallback-eyewear.svg';"
                 alt="${product.name}" 
                 class="modal-main-image" />
          </div>
          <div class="modal-dimensions-box">
            <h5>ISO 8624 Boxing Specifications</h5>
            <div class="specs-pill-grid">
              <div class="spec-pill"><span>Lens Width (A):</span> <strong>${product.dimensions.lensWidth} mm</strong></div>
              <div class="spec-pill"><span>Bridge (DBL):</span> <strong>${product.dimensions.bridge} mm</strong></div>
              <div class="spec-pill"><span>Temple:</span> <strong>${product.dimensions.temple} mm</strong></div>
              <div class="spec-pill"><span>Lens Height (B):</span> <strong>${product.dimensions.lensHeight} mm</strong></div>
            </div>
          </div>
        </div>

        <div class="modal-details-col">
          <div class="modal-header-meta">
            <span class="product-badge">${product.styleName}</span>
            <div class="product-rating">
              <span class="star-icon">★</span>
              <span>${product.rating}</span>
              <span class="reviews-count">(${product.reviewsCount} verified reviews)</span>
            </div>
          </div>

          <h2 class="modal-product-title">${product.name}</h2>
          <p class="modal-product-tagline">${product.tagline}</p>

          <div class="modal-pricing-row">
            <span class="currency">₹</span>
            <span class="price-val">${product.price.toLocaleString('en-IN')}</span>
            <span class="original-val">₹${product.originalPrice.toLocaleString('en-IN')}</span>
            <span class="discount-badge">Save ₹${(product.originalPrice - product.price).toLocaleString('en-IN')}</span>
          </div>

          <p class="modal-description">${product.description}</p>

          <div class="modal-swatches-section">
            <label class="modal-section-label">Select Colorway: <strong>${activeColor.name}</strong></label>
            <div class="swatches-list">
              ${product.colors.map((c, idx) => `
                <button type="button" 
                        class="color-swatch-dot ${idx === activeColorIndex ? 'active' : ''}" 
                        style="background-color: ${c.hex};" 
                        data-modal-color-idx="${idx}"
                        title="${c.name}">
                </button>
              `).join('')}
            </div>
          </div>

          <div class="modal-lens-options">
            <label class="modal-section-label">Compatible Ophthalmic Prescriptions:</label>
            <ul class="prescription-options-list">
              ${product.lensTypeOptions.map(opt => `
                <li>
                  <svg viewBox="0 0 20 20" fill="#059669" class="w-4 h-4 inline mr-1">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                  </svg>
                  ${opt}
                </li>
              `).join('')}
            </ul>
          </div>

          <div class="modal-actions-bar">
            <button class="btn btn-primary btn-lg" id="btnModalAddBag">
              Add to Bag &bull; ₹${product.price.toLocaleString('en-IN')}
            </button>
            <button class="btn btn-secondary btn-lg" id="btnModalTryStudio">
              Try in Studio
            </button>
            <button class="btn btn-secondary btn-icon-only" id="btnModalToggleFav" title="Save Frame">
              <svg viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" class="w-6 h-6">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    // Bind modal actions
    container.querySelectorAll('[data-modal-color-idx]').forEach(dot => {
      dot.addEventListener('click', () => {
        const idx = parseInt(dot.getAttribute('data-modal-color-idx'), 10);
        this.activeColors[product.id] = idx;
        this.openQuickViewModal(productId);
        this.renderCatalog();
      });
    });

    const addBagBtn = document.getElementById('btnModalAddBag');
    if (addBagBtn) {
      addBagBtn.addEventListener('click', () => {
        this.addToCart(product.id, activeColor.name);
        this.closeQuickViewModal();
      });
    }

    const tryStudioBtn = document.getElementById('btnModalTryStudio');
    if (tryStudioBtn) {
      tryStudioBtn.addEventListener('click', () => {
        this.studio.loadProduct(product);
        this.closeQuickViewModal();
        const studioEl = document.getElementById('virtualStudioSection');
        if (studioEl) studioEl.scrollIntoView({ behavior: 'smooth' });
      });
    }

    const toggleFavBtn = document.getElementById('btnModalToggleFav');
    if (toggleFavBtn) {
      toggleFavBtn.addEventListener('click', () => {
        this.toggleFavorite(product.id);
        this.openQuickViewModal(productId);
      });
    }

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  closeQuickViewModal() {
    const modal = document.getElementById('quickViewModal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  // ==================== DRAWERS & MODALS BINDINGS ====================
  bindDrawersAndModals() {
    // Quick View Modal Close
    const closeQuickView = document.getElementById('btnCloseQuickView');
    const modalOverlay = document.getElementById('quickViewModal');
    if (closeQuickView) {
      closeQuickView.addEventListener('click', () => this.closeQuickViewModal());
    }
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) this.closeQuickViewModal();
      });
    }

    // Favorites Drawer
    const navFavBtn = document.getElementById('navFavoritesBtn');
    const favDrawer = document.getElementById('favoritesDrawer');
    const closeFavDrawer = document.getElementById('btnCloseFavorites');
    const favOverlay = document.getElementById('favoritesDrawerOverlay');

    const openFavDrawer = () => {
      this.renderFavoritesDrawer();
      if (favDrawer) favDrawer.classList.add('open');
      if (favOverlay) favOverlay.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    };

    const closeFav = () => {
      if (favDrawer) favDrawer.classList.remove('open');
      if (favOverlay) favOverlay.classList.add('hidden');
      document.body.style.overflow = '';
    };

    if (navFavBtn) navFavBtn.addEventListener('click', openFavDrawer);
    if (closeFavDrawer) closeFavDrawer.addEventListener('click', closeFav);
    if (favOverlay) favOverlay.addEventListener('click', closeFav);

    // Cart Drawer
    const navCartBtn = document.getElementById('navCartBtn');
    const cartDrawer = document.getElementById('cartDrawer');
    const closeCartDrawer = document.getElementById('btnCloseCart');
    const cartOverlay = document.getElementById('cartDrawerOverlay');

    const openCart = () => {
      this.renderCartDrawer();
      if (cartDrawer) cartDrawer.classList.add('open');
      if (cartOverlay) cartOverlay.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    };

    const closeCart = () => {
      if (cartDrawer) cartDrawer.classList.remove('open');
      if (cartOverlay) cartOverlay.classList.add('hidden');
      document.body.style.overflow = '';
    };

    if (navCartBtn) navCartBtn.addEventListener('click', openCart);
    if (closeCartDrawer) closeCartDrawer.addEventListener('click', closeCart);
    if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

    // Escape Key listener for all open dialogs
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeQuickViewModal();
        closeFav();
        closeCart();
      }
    });
  }

  renderFavoritesDrawer() {
    const list = document.getElementById('favoritesList');
    if (!list) return;

    if (this.favorites.length === 0) {
      list.innerHTML = `
        <div class="empty-drawer-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-12 h-12">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          <h4>Your Saved Frames List is Empty</h4>
          <p>Browse our handcrafted collection and tap the heart icon to save frames here.</p>
        </div>
      `;
      return;
    }

    const favProducts = this.favorites.map(id => this.products.find(p => p.id === id)).filter(Boolean);

    list.innerHTML = favProducts.map(product => `
      <div class="drawer-item">
        <img src="${product.image}" onerror="this.onerror=null; this.src='assets/images/fallback-eyewear.svg';" alt="${product.name}" class="drawer-item-img" />
        <div class="drawer-item-details">
          <h5>${product.name}</h5>
          <span class="drawer-item-sub">${product.materialName}</span>
          <div class="drawer-item-price">₹${product.price.toLocaleString('en-IN')}</div>
          <div class="drawer-item-actions">
            <button class="btn btn-primary btn-xs btn-fav-move" data-move-id="${product.id}">
              Move to Bag
            </button>
            <button class="btn btn-secondary btn-xs btn-fav-remove" data-remove-id="${product.id}">
              Remove
            </button>
          </div>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.btn-fav-move').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.getAttribute('data-move-id');
        this.addToCart(pid);
        this.toggleFavorite(pid);
      });
    });

    list.querySelectorAll('.btn-fav-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.getAttribute('data-remove-id');
        this.toggleFavorite(pid);
      });
    });
  }

  renderCartDrawer() {
    const list = document.getElementById('cartItemsList');
    const subtotalEl = document.getElementById('cartSubtotalAmount');
    const shippingEl = document.getElementById('cartShippingStatus');
    const checkoutBtn = document.getElementById('btnCartCheckout');
    if (!list) return;

    if (this.cart.length === 0) {
      list.innerHTML = `
        <div class="empty-drawer-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-12 h-12">
            <path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          <h4>Your Shopping Bag is Empty</h4>
          <p>Select your favorite optical frames and custom lens configurations to begin.</p>
        </div>
      `;
      if (subtotalEl) subtotalEl.textContent = '₹0';
      if (checkoutBtn) checkoutBtn.disabled = true;
      return;
    }

    if (checkoutBtn) checkoutBtn.disabled = false;

    const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toLocaleString('en-IN')}`;

    if (shippingEl) {
      shippingEl.innerHTML = `<span class="text-green-600 font-semibold">✓ Free Insured Express Delivery Across India</span>`;
    }

    list.innerHTML = this.cart.map((item, idx) => `
      <div class="drawer-item">
        <img src="${item.image}" onerror="this.onerror=null; this.src='assets/images/fallback-eyewear.svg';" alt="${item.name}" class="drawer-item-img" />
        <div class="drawer-item-details">
          <h5>${item.name}</h5>
          <span class="drawer-item-sub">Color: ${item.color}</span>
          <div class="drawer-item-price">₹${(item.price * item.quantity).toLocaleString('en-IN')}</div>
          <div class="cart-qty-row">
            <div class="qty-stepper">
              <button class="btn-qty" data-qty-idx="${idx}" data-delta="-1">-</button>
              <span class="qty-num">${item.quantity}</span>
              <button class="btn-qty" data-qty-idx="${idx}" data-delta="1">+</button>
            </div>
            <button class="btn-remove-link" data-remove-idx="${idx}">Remove</button>
          </div>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.btn-qty').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-qty-idx'), 10);
        const delta = parseInt(btn.getAttribute('data-delta'), 10);
        this.updateCartQuantity(idx, delta);
      });
    });

    list.querySelectorAll('.btn-remove-link').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-remove-idx'), 10);
        this.removeFromCart(idx);
      });
    });

    if (checkoutBtn) {
      checkoutBtn.onclick = () => {
        this.openCheckoutModal();
      };
    }
  }

  // ==================== NAVBAR & GENERAL BINDINGS ====================
  bindNavbar() {
    const navbar = document.querySelector('.framelab-navbar');
    window.addEventListener('scroll', () => {
      if (window.scrollY > 40) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });

    // Mobile Hamburger
    const hamburgerBtn = document.getElementById('mobileMenuToggle');
    const mobileMenu = document.getElementById('mobileNavMenu');
    if (hamburgerBtn && mobileMenu) {
      hamburgerBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
      });
    }

    // Smooth scroll for nav anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        const href = anchor.getAttribute('href');
        if (href === '#' || href === '') return;
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth' });
          if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
            mobileMenu.classList.add('hidden');
          }
        }
      });
    });
  }

  bindNewsletter() {
    const form = document.getElementById('newsletterForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('newsletterEmail');
        if (input && input.value) {
          this.showToast(`Thank you for subscribing to FrameLab Editorial! (${input.value})`, 'success');
          input.value = '';
        }
      });
    }
  }

  bindFAQ() {
    document.querySelectorAll('.faq-question-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        item.classList.toggle('active');
        const icon = btn.querySelector('.faq-icon');
        if (icon) {
          icon.style.transform = item.classList.contains('active') ? 'rotate(180deg)' : 'rotate(0deg)';
        }
      });
    });
  }

  // Toast Notification System
  showToast(message, type = 'info') {
    const container = document.getElementById('toastNotificationContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `framelab-toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-dot"></div>
      <span class="toast-msg">${message}</span>
      <button class="toast-close" aria-label="Dismiss">&times;</button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ==========================================================================
  // RAZORPAY CHECKOUT & PAYMENT INTEGRATION (UPI, CARDS, NETBANKING)
  // ==========================================================================

  async initCheckout() {
    this.razorpayConfig = {
      keyId: 'rzp_test_5173FrameLab',
      currency: 'INR',
      testMode: true,
      freeShippingThreshold: 1999,
      expressShippingFee: 150
    };

    // Fetch live config from server
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data && data.success && data.config) {
        this.razorpayConfig = {
          ...this.razorpayConfig,
          ...data.config,
          ...data.store
        };
      }
    } catch (err) {
      console.warn('[Checkout] Notice reading /api/config, using default test settings:', err.message);
    }

    // Modal close button
    const closeBtn = document.getElementById('btnCloseCheckout');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeCheckoutModal());
    }

    // Close on backdrop click
    const checkoutModal = document.getElementById('checkoutModal');
    if (checkoutModal) {
      checkoutModal.addEventListener('click', (e) => {
        if (e.target === checkoutModal) this.closeCheckoutModal();
      });
    }

    // Shipping Method change radio listener
    const shippingRadios = document.querySelectorAll('input[name="shippingMethod"]');
    shippingRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        document.querySelectorAll('.shipping-method-option').forEach(opt => opt.classList.remove('active'));
        const parentOption = radio.closest('.shipping-method-option');
        if (parentOption) parentOption.classList.add('active');
        this.calculateCheckoutTotals();
      });
    });

    // Checkout Form Submit
    const form = document.getElementById('checkoutShippingForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleCheckoutFormSubmit(e));
    }

    // Receipt Modal Actions
    const printBtn = document.getElementById('btnPrintInvoice');
    if (printBtn) {
      printBtn.addEventListener('click', () => window.print());
    }

    const closeReceiptBtn = document.getElementById('btnCloseReceipt');
    const receiptModal = document.getElementById('orderReceiptModal');
    if (closeReceiptBtn) {
      closeReceiptBtn.addEventListener('click', () => {
        if (receiptModal) receiptModal.classList.add('hidden');
        document.body.style.overflow = '';
      });
    }

    // Razorpay Test Simulator Modal Actions
    const simModal = document.getElementById('rzpSimulatorModal');
    const closeSimBtn = document.getElementById('btnCloseRzpSimulator');
    const dismissSimBtn = document.getElementById('btnDismissRzpSim');

    const handleSimDismiss = () => {
      if (this.currentSimOrder) {
        this.handlePaymentDismissed(this.currentSimOrder.id, this.currentSimOrder.razorpayOrderId);
      }
      this.closeTestModeSimulator();
    };

    if (closeSimBtn) closeSimBtn.addEventListener('click', handleSimDismiss);
    if (dismissSimBtn) dismissSimBtn.addEventListener('click', handleSimDismiss);
    if (simModal) {
      simModal.addEventListener('click', (e) => {
        if (e.target === simModal) handleSimDismiss();
      });
    }

    // Simulator: UPI Instant
    const btnSimUPI = document.getElementById('btnSimulateUPI');
    if (btnSimUPI) {
      btnSimUPI.addEventListener('click', async () => {
        if (!this.currentSimOrder) return;
        const ord = this.currentSimOrder;
        this.closeTestModeSimulator();
        const simulatedPaymentId = `pay_upi_${Date.now().toString(36)}`;
        await this.verifyPaymentOnServer({
          orderId: ord.id,
          razorpay_order_id: ord.razorpayOrderId,
          razorpay_payment_id: simulatedPaymentId,
          razorpay_signature: 'test_signature_mode',
          paymentMethod: 'UPI (success@razorpay / Google Pay)',
          isSimulated: true
        });
      });
    }

    // Simulator: Card Instant
    const btnSimCard = document.getElementById('btnSimulateCard');
    if (btnSimCard) {
      btnSimCard.addEventListener('click', async () => {
        if (!this.currentSimOrder) return;
        const ord = this.currentSimOrder;
        this.closeTestModeSimulator();
        const simulatedPaymentId = `pay_card_${Date.now().toString(36)}`;
        await this.verifyPaymentOnServer({
          orderId: ord.id,
          razorpay_order_id: ord.razorpayOrderId,
          razorpay_payment_id: simulatedPaymentId,
          razorpay_signature: 'test_signature_mode',
          paymentMethod: 'Credit / Debit Card (Visa / RuPay)',
          isSimulated: true
        });
      });
    }

    // Simulator: NetBanking Instant
    const btnSimNB = document.getElementById('btnSimulateNetbanking');
    if (btnSimNB) {
      btnSimNB.addEventListener('click', async () => {
        if (!this.currentSimOrder) return;
        const ord = this.currentSimOrder;
        this.closeTestModeSimulator();
        const simulatedPaymentId = `pay_nb_${Date.now().toString(36)}`;
        await this.verifyPaymentOnServer({
          orderId: ord.id,
          razorpay_order_id: ord.razorpayOrderId,
          razorpay_payment_id: simulatedPaymentId,
          razorpay_signature: 'test_signature_mode',
          paymentMethod: 'NetBanking (HDFC / ICICI / SBI)',
          isSimulated: true
        });
      });
    }

    // Simulator: Failure / Decline
    const btnSimFail = document.getElementById('btnSimulateFailure');
    if (btnSimFail) {
      btnSimFail.addEventListener('click', async () => {
        if (!this.currentSimOrder) return;
        const ord = this.currentSimOrder;
        this.closeTestModeSimulator();
        await this.handlePaymentFailure({
          orderId: ord.id,
          razorpay_order_id: ord.razorpayOrderId,
          errorCode: 'BAD_REQUEST_ERROR',
          errorDescription: 'Transaction declined by bank: Simulated card limit or insufficient funds.',
          reason: 'payment_declined'
        });
      });
    }
  }

  openCheckoutModal() {
    if (!this.cart || this.cart.length === 0) {
      this.showToast('Your shopping bag is empty. Please select eyewear to purchase.', 'info');
      return;
    }

    // Close cart drawer
    const cartDrawer = document.getElementById('cartDrawer');
    const cartOverlay = document.getElementById('cartDrawerOverlay');
    if (cartDrawer) cartDrawer.classList.remove('open');
    if (cartOverlay) cartOverlay.classList.add('hidden');

    // Populate items list
    this.renderCheckoutItems();
    this.calculateCheckoutTotals();

    // Reset error messages
    document.querySelectorAll('.field-error').forEach(el => el.textContent = '');

    const modal = document.getElementById('checkoutModal');
    if (modal) {
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  closeCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  renderCheckoutItems() {
    const list = document.getElementById('checkoutOrderItemsList');
    if (!list) return;

    list.innerHTML = this.cart.map(item => `
      <div class="checkout-item-row">
        <img src="${item.image}" onerror="this.onerror=null; this.src='assets/images/fallback-eyewear.svg';" alt="${item.name}" class="checkout-item-thumb" />
        <div class="checkout-item-info">
          <div class="checkout-item-title">${item.name}</div>
          <div class="checkout-item-meta">Color: ${item.color} &bull; Qty: ${item.quantity}</div>
        </div>
        <div class="checkout-item-price">₹${(item.price * item.quantity).toLocaleString('en-IN')}</div>
      </div>
    `).join('');
  }

  calculateCheckoutTotals() {
    const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const subtotalEl = document.getElementById('checkoutSubtotal');
    if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toLocaleString('en-IN')}`;

    // Shipping method
    const selectedRadio = document.querySelector('input[name="shippingMethod"]:checked');
    const method = selectedRadio ? selectedRadio.value : 'standard';

    let shippingFee = 0;
    const threshold = this.razorpayConfig?.freeShippingThreshold || 1999;

    if (method === 'priority') {
      shippingFee = this.razorpayConfig?.expressShippingFee || 150;
    } else {
      shippingFee = subtotal >= threshold ? 0 : 99;
    }

    const shippingEl = document.getElementById('checkoutDeliveryCharges');
    if (shippingEl) {
      if (shippingFee === 0) {
        shippingEl.textContent = 'FREE';
        shippingEl.className = 'text-green font-bold';
      } else {
        shippingEl.textContent = `₹${shippingFee}`;
        shippingEl.className = 'font-mono';
      }
    }

    const standardLabel = document.getElementById('checkoutStandardFeeLabel');
    if (standardLabel) {
      standardLabel.textContent = subtotal >= threshold ? 'FREE' : '₹99';
    }

    const grandTotal = subtotal + shippingFee;
    const totalEl = document.getElementById('checkoutGrandTotal');
    if (totalEl) totalEl.textContent = `₹${grandTotal.toLocaleString('en-IN')}`;

    const payBtnText = document.getElementById('btnPayText');
    if (payBtnText) {
      payBtnText.textContent = `Pay via Razorpay • ₹${grandTotal.toLocaleString('en-IN')}`;
    }

    return { subtotal, shippingFee, grandTotal, method };
  }

  async handleCheckoutFormSubmit(e) {
    e.preventDefault();

    // 1. Client-side Form Validation
    let isValid = true;
    const errors = {};

    const name = document.getElementById('shippingFullName').value.trim();
    if (!name || name.length < 2) {
      errors.shippingFullName = 'Please enter your full legal name.';
      isValid = false;
    }

    const email = document.getElementById('shippingEmail').value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      errors.shippingEmail = 'Please provide a valid email address.';
      isValid = false;
    }

    const phone = document.getElementById('shippingPhone').value.trim().replace(/\D/g, '');
    if (!phone || phone.length !== 10) {
      errors.shippingPhone = 'Please provide a 10-digit Indian mobile number.';
      isValid = false;
    }

    const address = document.getElementById('shippingAddress').value.trim();
    if (!address || address.length < 5) {
      errors.shippingAddress = 'Please enter your complete street/flat address.';
      isValid = false;
    }

    const city = document.getElementById('shippingCity').value.trim();
    if (!city) {
      errors.shippingCity = 'Please enter your delivery city.';
      isValid = false;
    }

    const state = document.getElementById('shippingState').value.trim();
    if (!state) {
      errors.shippingState = 'Please select your delivery state.';
      isValid = false;
    }

    const pincode = document.getElementById('shippingPincode').value.trim().replace(/\D/g, '');
    if (!pincode || pincode.length !== 6) {
      errors.shippingPincode = 'Please enter a valid 6-digit Indian PIN code.';
      isValid = false;
    }

    // Display inline field errors
    document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
    Object.keys(errors).forEach(fieldId => {
      const errEl = document.getElementById(`err-${fieldId}`);
      if (errEl) errEl.textContent = errors[fieldId];
    });

    if (!isValid) {
      const firstErrorField = Object.keys(errors)[0];
      const el = document.getElementById(firstErrorField);
      if (el) el.focus();
      this.showToast('Please correct highlighted fields before proceeding to payment.', 'info');
      return;
    }

    const customer = { fullName: name, email, phone, address, city, state, pincode };
    const { method } = this.calculateCheckoutTotals();

    // 2. Initiate Razorpay Order from Backend
    await this.initiateRazorpayPayment(customer, method);
  }

  async initiateRazorpayPayment(customer, shippingMethod) {
    const payBtn = document.getElementById('btnPayWithRazorpay');
    const payBtnText = document.getElementById('btnPayText');
    const originalText = payBtnText.textContent;

    try {
      payBtn.disabled = true;
      payBtnText.textContent = 'Generating Razorpay Order...';

      // Call secure backend endpoint
      const response = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: this.cart,
          customer,
          shippingMethod
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create payment order on server.');
      }

      const orderData = data.order;
      console.log('[Checkout] Backend Order Created:', orderData);

      // Check if standard Razorpay Checkout SDK is available and active credentials are not simulated
      if (typeof window.Razorpay === 'function' && !orderData.isSimulated) {
        const options = {
          key: orderData.keyId,
          amount: orderData.amount, // in paise
          currency: orderData.currency || 'INR',
          name: 'FrameLab Haute Eyewear',
          description: `Order ${orderData.id} • ${orderData.items.length} Eyewear Item(s)`,
          image: 'assets/images/fallback-eyewear.svg',
          order_id: orderData.razorpayOrderId,
          prefill: {
            name: orderData.customer.fullName,
            email: orderData.customer.email,
            contact: `+91${orderData.customer.phone}`
          },
          notes: {
            order_id: orderData.id,
            pincode: orderData.customer.pincode
          },
          theme: {
            color: '#0B1325'
          },
          handler: async (resp) => {
            console.log('[Razorpay] Payment Succeeded on Gateway, verifying signature on backend:', resp);
            await this.verifyPaymentOnServer({
              orderId: orderData.id,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
              paymentMethod: 'Razorpay Online'
            });
          },
          modal: {
            ondismiss: () => {
              console.log('[Razorpay] Checkout modal dismissed by patron');
              this.handlePaymentDismissed(orderData.id, orderData.razorpayOrderId);
            }
          }
        };

        const rzp = new window.Razorpay(options);

        rzp.on('payment.failed', (resp) => {
          console.error('[Razorpay] Payment Failed:', resp.error);
          this.handlePaymentFailure({
            orderId: orderData.id,
            razorpay_order_id: orderData.razorpayOrderId,
            errorCode: resp.error.code,
            errorDescription: resp.error.description,
            reason: resp.error.reason
          });
        });

        rzp.open();
        payBtn.disabled = false;
        payBtnText.textContent = originalText;

      } else {
        // Fallback simulation interface if SDK is offline/blocked in local dev
        this.openTestModeSimulator(orderData);
        payBtn.disabled = false;
        payBtnText.textContent = originalText;
      }

    } catch (err) {
      console.error('[Checkout] Error:', err);
      this.showToast(err.message, 'info');
      payBtn.disabled = false;
      payBtnText.textContent = originalText;
    }
  }

  // Open Test Mode Simulator Dialog for local testing
  openTestModeSimulator(orderData) {
    this.currentSimOrder = orderData;
    const modal = document.getElementById('rzpSimulatorModal');
    if (!modal) return;

    const amtEl = document.getElementById('rzpSimAmount');
    if (amtEl) amtEl.textContent = `₹${orderData.amountInRupees.toLocaleString('en-IN')}`;

    const orderIdEl = document.getElementById('rzpSimOrderId');
    if (orderIdEl) orderIdEl.textContent = orderData.id;

    const gatewayIdEl = document.getElementById('rzpSimGatewayId');
    if (gatewayIdEl) gatewayIdEl.textContent = orderData.razorpayOrderId;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  closeTestModeSimulator() {
    const modal = document.getElementById('rzpSimulatorModal');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  async verifyPaymentOnServer(paymentData) {
    this.showToast('Verifying payment signature with secure backend...', 'info');

    try {
      const response = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.message || 'Signature verification failed.');
      }

      console.log('[Payment Verified]', result.order);

      // 1. Clear cart in state & localStorage
      this.cart = [];
      this.saveCart();

      // 2. Close checkout modal and simulator
      this.closeCheckoutModal();
      this.closeTestModeSimulator();

      // 3. Show order confirmation modal & receipt
      this.showOrderReceipt(result.order);

      this.showToast('Payment verified successfully! Your order has been placed.', 'success');

    } catch (err) {
      console.error('[Verification Error]', err);
      this.showToast(`Verification Alert: ${err.message}`, 'info');
    }
  }

  async handlePaymentFailure(failureData) {
    try {
      await fetch('/api/payment-failed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(failureData)
      });
    } catch (_) {}

    this.showToast(`Payment declined: ${failureData.errorDescription || 'Transaction failed'}. Please retry.`, 'info');
  }

  async handlePaymentDismissed(orderId, razorpayOrderId) {
    try {
      await fetch('/api/payment-failed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          razorpay_order_id: razorpayOrderId,
          reason: 'Customer dismissed payment gateway window'
        })
      });
    } catch (_) {}

    this.showToast('Payment was not completed. Your frames remain saved in your bag.', 'info');
  }

  showOrderReceipt(order) {
    const modal = document.getElementById('orderReceiptModal');
    if (!modal) return;

    document.getElementById('receiptOrderId').textContent = order.id;
    document.getElementById('receiptPaymentId').textContent = order.razorpayPaymentId || order.razorpayOrderId || 'Verified';
    document.getElementById('receiptPaymentMethod').textContent = order.paymentMethod || 'Razorpay UPI/Cards';

    const addr = order.customer;
    document.getElementById('receiptCustomerAddress').innerHTML = `
      <strong>${addr.fullName}</strong> &bull; Phone: +91-${addr.phone} &bull; Email: ${addr.email}<br>
      ${addr.address}, ${addr.city}, ${addr.state} - PIN: ${addr.pincode}
    `;

    const tbody = document.getElementById('receiptItemsTbody');
    if (tbody) {
      tbody.innerHTML = order.items.map(item => `
        <tr>
          <td><strong>${item.name}</strong></td>
          <td>Color: ${item.color}</td>
          <td>${item.quantity}</td>
          <td class="font-mono">₹${(item.price * item.quantity).toLocaleString('en-IN')}</td>
        </tr>
      `).join('');
    }

    document.getElementById('receiptTotalAmount').textContent = `₹${order.pricing.totalAmount.toLocaleString('en-IN')}`;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

// Launch on DOM Content Loaded
window.addEventListener('DOMContentLoaded', () => {
  window.FrameLab = new FrameLabApp();
});
