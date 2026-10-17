(() => {
  'use strict';
  const setup = window.SETUP;
  const core = window.CodekitCore;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const categoryLabels = {appearance:'Внешний вид',python:'Python',web:'Web',tools:'Инструменты'};
  const selected = new Set(setup.extensions.map(extension => extension.id));
  const state = {category:'all', query:'', os:'windows'};
  const grid = $('#extension-grid');
  const commandsDialog = $('#commands-dialog');
  let toastTimer;

  function toast(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').classList.add('visible');
    $('#command-feedback').textContent = commandsDialog.open ? message : '';
    toastTimer = setTimeout(() => {
      $('#toast').classList.remove('visible');
      $('#command-feedback').textContent = '';
    }, 3300);
  }

  function download(content, filename, type = 'application/json;charset=utf-8') {
    const url = URL.createObjectURL(new Blob([content], {type}));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function copy(text, label) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      toast(label);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.cssText = 'position:fixed;top:0;left:-9999px;';
      // Внутри модального окна фокус может перемещаться только внутри него.
      const container = commandsDialog.open ? commandsDialog : document.body;
      container.append(textarea);
      textarea.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch { /* manual fallback below */ }
      textarea.remove();
      if (copied) toast(label);
      else {
        $('#copy-fallback').value = text;
        $('#copy-dialog').showModal();
        $('#copy-fallback').focus();
        $('#copy-fallback').select();
      }
    }
  }

  function chosenExtensions() {
    return setup.extensions.filter(extension => selected.has(extension.id));
  }

  function updateSelection() {
    $$('[data-selected-count]').forEach(element => element.textContent = selected.size);
    $('#select-all').checked = selected.size === setup.extensions.length;
    $('#select-all').indeterminate = selected.size > 0 && selected.size < setup.extensions.length;
    $('#copy-command').disabled = selected.size === 0;
    $('#download-command').disabled = selected.size === 0;
    updateCommand();
  }

  function renderExtensions() {
    const extensions = core.filter(setup.extensions, state.category, state.query);
    grid.innerHTML = extensions.map(extension => {
      const e = core.escapeHtml;
      const checked = selected.has(extension.id);
      return `<article class="extension-card${checked ? '' : ' is-unselected'}" data-id="${e(extension.id)}">
        <label class="extension-check"><input type="checkbox" value="${e(extension.id)}" ${checked ? 'checked' : ''} aria-label="Включить ${e(extension.name)} в профиль"></label>
        <div class="extension-main"><div class="extension-header"><div class="extension-icon ${e(extension.color)}" aria-hidden="true"><span>${e(extension.icon)}</span></div><div class="extension-title"><h3 title="${e(extension.name)}">${e(extension.name)}</h3><p>${e(extension.publisher)}</p></div></div><p class="extension-description">${e(extension.description)}</p></div>
        <div class="extension-bottom"><span class="extension-category">${categoryLabels[extension.category]}</span><div class="extension-links"><a href="vscode:extension/${encodeURIComponent(extension.id)}" title="Открыть ${e(extension.name)} в VS Code">VS Code <svg><use href="#i-external"/></svg></a><a class="market-link" href="https://marketplace.visualstudio.com/items?itemName=${encodeURIComponent(extension.id)}" target="_blank" rel="noopener noreferrer" aria-label="${e(extension.name)} в Marketplace" title="Открыть Marketplace"><svg><use href="#i-box"/></svg></a></div></div></article>`;
    }).join('');
    // Локальные иконки загружаются при наличии; текстовая иконка остаётся запасной.
    grid.querySelectorAll('.extension-icon').forEach((container, index) => {
      const img = new Image();
      img.alt = '';
      img.loading = 'lazy';
      img.addEventListener('load', () => container.replaceChildren(img));
      img.src = './assets/extensions/' + extensions[index].id.toLowerCase() + '.png';
    });
    $('#empty-state').hidden = extensions.length !== 0;
    $('#result-count').textContent = `Показано ${extensions.length} из ${setup.extensions.length}`;
    updateSelection();
  }

  function updateCommand() {
    const command = core.command(chosenExtensions(), $('#shell-select').value);
    $('#install-command').textContent = command || 'Выбери хотя бы одно расширение в списке.';
  }

  function openCommands() {
    $('#command-feedback').textContent = '';
    updateCommand();
    commandsDialog.showModal();
  }

  function exportProfile() {
    const profile = core.profile(setup.settings, chosenExtensions(), setup.name);
    download(JSON.stringify(profile, null, 2) + '\n', 'my-vscode.code-profile');
    toast(`Профиль готов: настройки и ${selected.size} расширений`);
  }

  function setOS(os) {
    state.os = os;
    $$('[data-os]').forEach(button => {
      const active = button.dataset.os === os;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const instructions = {
      windows:'Распакуй архив шрифта. Выдели все .ttf, нажми правой кнопкой → «Установить» (в Windows 11 — «Показать дополнительные параметры»). Перезапусти VS Code.',
      macos:'Распакуй архив шрифта. Открой файлы .ttf в приложении «Шрифты» (Font Book) и нажми «Установить». Затем перезапусти VS Code.',
      linux:'Распакуй архив. Скопируй файлы .ttf в ~/.local/share/fonts (создай папку, если её нет). Выполни fc-cache -f и перезапусти VS Code.'
    };
    $('#font-install-instruction').textContent = instructions[os];
    $('#palette-shortcut').textContent = os === 'macos' ? '⌘ + Shift + P' : 'Ctrl + Shift + P';
    // Меню Preferences на macOS находится в меню приложения.
    $('.step:nth-child(2) p strong').textContent = os === 'macos' ? 'Code → Settings → Profiles' : 'File → Preferences → Profiles';
    $('#shell-select').value = os === 'windows' ? 'powershell' : 'bash';
    updateCommand();
  }

  grid.addEventListener('change', event => {
    if (!event.target.matches('input[type="checkbox"]')) return;
    const checkbox = event.target;
    if (checkbox.checked) selected.add(checkbox.value);
    else selected.delete(checkbox.value);
    checkbox.closest('.extension-card').classList.toggle('is-unselected', !checkbox.checked);
    updateSelection();
  });
  $('#select-all').addEventListener('change', event => {
    selected.clear();
    if (event.target.checked) setup.extensions.forEach(extension => selected.add(extension.id));
    renderExtensions();
  });
  $$('[data-filter]').forEach(button => button.addEventListener('click', () => {
    state.category = button.dataset.filter;
    $$('[data-filter]').forEach(item => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    renderExtensions();
  }));
  $('#extension-search').addEventListener('input', event => {
    state.query = event.target.value;
    renderExtensions();
  });
  $('#reset-search').addEventListener('click', () => {
    state.query = '';
    state.category = 'all';
    $('#extension-search').value = '';
    $$('[data-filter]').forEach(button => {
      const active = button.dataset.filter === 'all';
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    renderExtensions();
    $('#extension-search').focus();
  });
  $$('[data-action="profile"]').forEach(button => button.addEventListener('click', exportProfile));
  ['#open-commands','#open-commands-manual'].forEach(selector => $(selector).addEventListener('click', openCommands));
  ['#copy-settings','#copy-settings-manual'].forEach(selector => $(selector).addEventListener('click', () => copy(core.settingsText(setup.settings), 'Настройки скопированы')));
  $('#close-dialog').addEventListener('click', () => commandsDialog.close());
  $('#close-copy-dialog').addEventListener('click', () => $('#copy-dialog').close());
  $$('dialog').forEach(dialog => dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const {left,right,top,bottom} = dialog.getBoundingClientRect();
    if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) dialog.close();
  }));
  $('#shell-select').addEventListener('change', updateCommand);
  $('#copy-command').addEventListener('click', () => {
    const command = core.command(chosenExtensions(), $('#shell-select').value);
    if (command) return copy(command, 'Команда установки скопирована');
  });
  $('#download-command').addEventListener('click', () => {
    const shell = $('#shell-select').value;
    const command = core.command(chosenExtensions(), shell);
    if (!command) return;
    const ext = {powershell:'ps1',cmd:'cmd',bash:'sh'}[shell];
    const prefix = shell === 'bash' ? '#!/usr/bin/env bash\n' : shell === 'cmd' ? '@echo off\r\n' : '';
    download(prefix + command + '\n', 'install-extensions.' + ext, 'text/plain;charset=utf-8');
    toast('Файл с командами готов');
  });
  $('#ligatures-toggle').addEventListener('change', event => {
    const enabled = event.target.checked;
    $('.font-playground').classList.toggle('no-ligatures', !enabled);
    $('.font-caption>span:last-child').textContent = enabled ? 'Лигатуры включены' : 'Лигатуры выключены';
  });
  $$('[data-os]').forEach(button => button.addEventListener('click', () => setOS(button.dataset.os)));

  const settingsText = core.settingsText(setup.settings);
  // Сначала экранируем HTML, потом добавляем только свои span для подсветки.
  $('#settings-source').innerHTML = settingsText.split('\n').map(line => {
    const key = /^(\s*)("(?:\\.|[^"\\])*"\s*:)(.*)$/.exec(line);
    function highlightValue(value) {
      return value.split(/("(?:\\.|[^"\\])*"|\btrue\b|\bfalse\b|\bnull\b|\b\d+\b)/g).map((part,index) => {
        if (index % 2 === 0) return core.escapeHtml(part);
        const type = part.startsWith('"') ? 'string' : /^\d/.test(part) ? 'number' : 'boolean';
        return `<span class="json-${type}">${core.escapeHtml(part)}</span>`;
      }).join('');
    }
    return key ? core.escapeHtml(key[1]) + `<span class="json-key">${core.escapeHtml(key[2])}</span>` + highlightValue(key[3]) : highlightValue(line);
  }).join('\n');
  $('#settings-lines').textContent = `${settingsText.trimEnd().split('\n').length} строк · JSON`;

  renderExtensions();
  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  setOS(/mac/i.test(platform) ? 'macos' : /linux/i.test(platform) ? 'linux' : 'windows');
  // Якорные ссылки работают и без IntersectionObserver.
  if ('IntersectionObserver' in window) {
    const sections = ['overview','extensions','settings','font'].map(id => document.getElementById(id));
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        $$('.navigation .nav-link').forEach(link => {
          const active = link.getAttribute('href') === '#' + entry.target.id;
          link.classList.toggle('active', active);
          if (active) link.setAttribute('aria-current','location');
          else link.removeAttribute('aria-current');
        });
      }
    }, {rootMargin:'-5% 0px -70% 0px',threshold:0});
    sections.forEach(section => observer.observe(section));
  }
})();
