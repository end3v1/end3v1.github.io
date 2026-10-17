// Пересобирает скачиваемый набор. Нужен только Node.js, без npm install.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {deflateRawSync} from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = {window:{}};
for (const file of ['data.js','core.js']) vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),context);
const setup = context.window.SETUP;
const core = context.window.CodekitCore;
const out = path.join(root,'downloads');
fs.mkdirSync(out,{recursive:true});
const save = (name,contents) => fs.writeFileSync(path.join(out,name),contents);
save('settings.json',core.settingsText(setup.settings));
save('extensions.json',JSON.stringify({recommendations:setup.extensions.map(extension=>extension.id)},null,2)+'\n');
save('extensions.txt',setup.extensions.map(extension=>extension.id).join('\n')+'\n');
save('my-vscode.code-profile',JSON.stringify(core.profile(setup.settings,setup.extensions,setup.name),null,2)+'\n');
save('install-extensions.ps1',core.command(setup.extensions,'powershell')+'\n');
save('install-extensions.cmd','@echo off\r\n'+core.command(setup.extensions,'cmd')+'\r\n');
save('install-extensions.sh','#!/usr/bin/env bash\n'+core.command(setup.extensions,'bash')+'\n');
save('START-HERE.txt',`МОЙ НАБОР VS CODE

1. Импортируй my-vscode.code-profile через меню профилей VS Code:
   File → Preferences → Profiles → меню рядом с New Profile → Import Profile…
   На macOS: Code → Settings → Profiles.
   Выбери файл, проверь состав и нажми Create.
2. Установи файлы .ttf из папки fonts, затем перезапусти VS Code.
   Windows: выделить .ttf → правой кнопкой → Установить.
   Windows 11: сначала «Показать дополнительные параметры».
   macOS: открыть .ttf в приложении «Шрифты», нажать «Установить».
   Linux: скопировать .ttf в ~/.local/share/fonts, выполнить fc-cache -f.

Без профиля:
— В палитре команд открой Preferences: Open User Settings (JSON).
— Перенеси нужные ключи из settings.json. Сохрани старые настройки перед заменой.
— Открой подходящий install-extensions.* в редакторе, скопируй команду
  в терминал и выполни её. Это обходит ограничения запуска .ps1 в Windows.
— Команда code должна быть доступна в PATH. На macOS добавь её через
  Shell Command: Install 'code' command in PATH в палитре VS Code.

Список содержит ${setup.extensions.length} расширений со скриншотов.
Это список для установки из Marketplace, а не копии расширений (.vsix).
Для установки нужен интернет. Версии не закреплены: устанавливаются
доступные совместимые версии. Python, Go и другие среды ставятся отдельно.
extensions.json — рекомендации для папки .vscode проекта, не установщик.

Шрифт: JetBrains Mono от JetBrains, SIL Open Font License 1.1.
https://www.jetbrains.com/lp/mono/
https://code.visualstudio.com/docs/configure/profiles
`);

// ZIP/Deflate с UTF-8 именами. Сборка без сторонних библиотек.
const crcTable = Array.from({length:256},(_,n)=>{
  for(let bit=0;bit<8;bit++) n = (n&1) ? 0xedb88320^(n>>>1) : n>>>1;
  return n>>>0;
});
function crc32(buffer) {
  let crc=0xffffffff;
  for(const byte of buffer) crc=crcTable[(crc^byte)&255]^(crc>>>8);
  return (crc^0xffffffff)>>>0;
}
function zip(entries) {
  const locals=[],centrals=[];
  let offset=0;
  for(const [filename,input] of entries) {
    const name=Buffer.from(filename,'utf8');
    const data=Buffer.isBuffer(input)?input:Buffer.from(input);
    const compressed=deflateRawSync(data);
    const crc=crc32(data);
    const local=Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);
    local.writeUInt16LE(0x800,6);local.writeUInt16LE(8,8);
    local.writeUInt16LE(0x21,12);local.writeUInt32LE(crc,14);
    local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(data.length,22);
    local.writeUInt16LE(name.length,26);
    const central=Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);
    central.writeUInt16LE(20,6);central.writeUInt16LE(0x800,8);
    central.writeUInt16LE(8,10);central.writeUInt16LE(0x21,14);
    central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);
    central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);
    central.writeUInt32LE(offset,42);
    locals.push(local,name,compressed);centrals.push(central,name);
    offset+=local.length+name.length+compressed.length;
  }
  const directory=Buffer.concat(centrals),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);
  end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);
  end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,directory,end]);
}
const fontFiles=fs.readdirSync(path.join(root,'assets/fonts')).filter(name=>/\.ttf$|^OFL\.txt$/.test(name));
const fonts=fontFiles.map(name=>['fonts/'+name,fs.readFileSync(path.join(root,'assets/fonts',name))]);
save('jetbrains-mono.zip',zip(fonts));
const bundle=['my-vscode.code-profile','settings.json','extensions.json','extensions.txt','install-extensions.ps1','install-extensions.cmd','install-extensions.sh','START-HERE.txt'];
save('vscode-setup.zip',zip([...bundle.map(name=>[name,fs.readFileSync(path.join(out,name))]),...fonts]));
console.log(`Готово: ${setup.extensions.length} расширений, ${Object.keys(setup.settings).length} настроек, ${fontFiles.length-1} файла шрифта.`);
