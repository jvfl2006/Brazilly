(() => {
  'use strict';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'streaming-float-jump';
  button.setAttribute('aria-label', 'Abrir Brazilly Cinema');
  button.title = 'Brazilly Cinema';

  const cinemaIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="m10 9 5 3-5 3z"></path></svg>';
  const editIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path></svg>';

  function updateFloatingAction(screenId) {
    const onOwnProfile = screenId === 'profileScreen';

    if (onOwnProfile) {
      button.setAttribute('aria-label', 'Editar meu perfil');
      button.title = 'Editar meu perfil';
      button.innerHTML = editIcon;
      button.dataset.action = 'edit-profile';
    } else {
      button.setAttribute('aria-label', 'Abrir Brazilly Cinema');
      button.title = 'Brazilly Cinema';
      button.innerHTML = cinemaIcon;
      button.dataset.action = 'cinema';
    }
  }

  button.addEventListener('click', () => {
    if (button.dataset.action === 'edit-profile') {
      document.getElementById('profileEditButton')?.click();
      return;
    }

    if (typeof window.showScreen === 'function') {
      window.showScreen('streamingScreen');
    }
  });

  document.addEventListener('brazilly:screen-changed', event => {
    updateFloatingAction(event.detail);
  });

  document.getElementById('streamingExploreButton')?.addEventListener('click', () => {
    if (typeof window.showScreen === 'function') {
      window.showScreen('streamingScreen');
    }
  });

  updateFloatingAction(document.querySelector('.screen.active')?.id || 'homeScreen');
  document.body.append(button);
})();
