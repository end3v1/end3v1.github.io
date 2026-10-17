/* Общая логика сайта и генератора скачиваемых файлов. */
window.CodekitCore = Object.freeze({
  settingsText(settings) {
    return JSON.stringify(settings, null, 4) + '\n';
  },
  profile(settings, extensions, name = 'My VS Code') {
    return {
      name,
      settings: JSON.stringify({ settings: this.settingsText(settings) }),
      extensions: JSON.stringify(extensions.map(extension => ({
        identifier: { id: extension.id },
        displayName: extension.name,
        preRelease: false,
        disabled: false
      })))
    };
  },
  command(extensions, shell = 'powershell') {
    if (!extensions.length) return '';
    // Идентификаторы — только publisher.extension. Не допускаем shell-код.
    for (const {id} of extensions) {
      if (!/^[a-z0-9-]+\.[a-z0-9-]+$/i.test(id)) throw new Error('Некорректный ID расширения');
    }
    const continuation = shell === 'powershell' ? ' `\n' : shell === 'cmd' ? ' ^\r\n' : ' \\\n';
    return 'code' + continuation + extensions.map(({id}) => '  --install-extension ' + id).join(continuation);
  },
  filter(extensions, category, query) {
    const normalized = query.trim().toLocaleLowerCase('ru');
    return extensions.filter(extension =>
      (category === 'all' || extension.category === category) &&
      [extension.name, extension.id, extension.publisher, extension.description].join(' ').toLocaleLowerCase('ru').includes(normalized)
    );
  },
  escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
});
