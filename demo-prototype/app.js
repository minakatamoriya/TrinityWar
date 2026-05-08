const screens = document.querySelectorAll('.screen');
const navItems = document.querySelectorAll('[data-target-screen]');
const sceneTitle = document.getElementById('scene-title');
const modalBackdrop = document.getElementById('modal-backdrop');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');
const modalCancel = document.getElementById('modal-cancel');
const modalConfirm = document.getElementById('modal-confirm');

function setActiveScreen(screenName) {
  screens.forEach((screen) => {
    const isActive = screen.id === `screen-${screenName}`;
    screen.classList.toggle('active', isActive);
    if (isActive) {
      sceneTitle.textContent = screen.dataset.title;
    }
  });

  document.querySelectorAll('.nav-item').forEach((button) => {
    button.classList.toggle('active', button.dataset.targetScreen === screenName);
  });
}

function openModal(title, body) {
  modalTitle.textContent = title;
  modalBody.textContent = body;
  modalBackdrop.classList.remove('hidden');
}

function closeModal() {
  modalBackdrop.classList.add('hidden');
}

document.addEventListener('click', (event) => {
  const targetScreen = event.target.closest('[data-target-screen]');
  if (targetScreen) {
    setActiveScreen(targetScreen.dataset.targetScreen);
  }

  const modalTrigger = event.target.closest('[data-modal-title]');
  if (modalTrigger) {
    openModal(modalTrigger.dataset.modalTitle, modalTrigger.dataset.modalBody);
  }

  const targetCard = event.target.closest('.target-card');
  if (targetCard) {
    document.querySelectorAll('.target-card').forEach((card) => card.classList.remove('selected'));
    targetCard.classList.add('selected');
    document.getElementById('target-name').textContent = targetCard.dataset.targetName;
    document.getElementById('target-risk').textContent = targetCard.dataset.targetRisk;
    document.getElementById('target-loot').textContent = targetCard.dataset.targetLoot;
    document.getElementById('target-detail').textContent = targetCard.dataset.targetDetail;
  }

  const attackButton = event.target.closest('.attack-button');
  if (attackButton) {
    setActiveScreen('result');
  }
});

document.querySelectorAll('[data-report-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-report-tab]').forEach((tab) => tab.classList.remove('active'));
    document.querySelectorAll('.report-tab-content').forEach((content) => content.classList.remove('active'));
    button.classList.add('active');
    document.getElementById(`report-tab-${button.dataset.reportTab}`).classList.add('active');
  });
});

document.querySelectorAll('[data-faction-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-faction-tab]').forEach((tab) => tab.classList.remove('active'));
    document.querySelectorAll('.faction-tab-content').forEach((content) => content.classList.remove('active'));
    button.classList.add('active');
    document.getElementById(`faction-tab-${button.dataset.factionTab}`).classList.add('active');
  });
});

[modalClose, modalCancel, modalConfirm].forEach((element) => {
  element.addEventListener('click', closeModal);
});

modalBackdrop.addEventListener('click', (event) => {
  if (event.target === modalBackdrop) {
    closeModal();
  }
});

setActiveScreen('home');