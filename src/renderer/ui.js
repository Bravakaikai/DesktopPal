(() => {
  let language = 'system';
  const resolved = () => language === 'system' ? (/^zh-(cn|sg|hans)/i.test(navigator.language) ? 'zh-Hans' : /^zh/i.test(navigator.language) ? 'zh-Hant' : 'en') : language;
  const labels = {
    hunger:['飽食度','Fullness'],
    toy:['玩具','Toy'],stopToy:['結束玩耍 · Esc','Stop playing · Esc'],energy:['活力','Energy'],cleanliness:['乾淨度','Cleanliness'],happiness:['開心值','Happiness'],
    choose: ['切換寵物','Choose pet'], feed:['餵食','Feed'], clean:['清理','Clean'],
    sleep:['休息','Sleep'], wake:['叫醒','Wake up'], water:['補充水分','Drink some water'], stretch:['起來動一動','Stand up and stretch'],
    done:['完成','Done'], later:['5 分鐘後提醒','Remind me in 5 minutes'], reminders:['健康提醒','Wellness reminders'],
    enabled:['開啟提醒','Enable reminders'], enabledHint:['久坐時提醒你起來動一動、記得補充水分','Reminds you to stand up and stretch, and to drink water, after sitting still for a while'],
    minutes:['分鐘','minutes'], reveal:['把寵物帶到這個螢幕','Bring pet to this screen'], settings:['設定','Settings'], showPet:['顯示寵物','Show pet'],
    showPetHint:['顯示或隱藏桌面上的寵物','Show or hide the pet on your desktop'],
    stretchHint:['每隔幾分鐘提醒你起來動一動','How often to remind you to stand up and stretch (minutes)'],
    waterHint:['每隔幾分鐘提醒你喝水','How often to remind you to drink water (minutes)'],
    help:['使用說明','How to use'],
    namePlaceholder:['幫寵物取名字','Name your pet'],
    title:['選一位桌面小夥伴','Choose your little companion'],
    hint:['按住寵物拖曳，可以移動位置\n點擊牠或用滑鼠來回搓一搓，牠會很開心\n把滑鼠移到牠身上，會出現餵食、休息、清理按鈕\n地上出現髒東西時，點一下就能清乾淨',
      'Hold and drag the pet to move it\nClick it, or rub the mouse back and forth over it — it loves that\nHover over it to reveal the Feed / Sleep / Clean buttons\nClick any mess on the ground to clean it up'],
    dog:['巴哥犬','Pug'],fish:['小丑魚','Clownfish'],cat:['橘白貓','Tabby kitten'],rabbit:['白兔','White bunny'],pig:['粉紅豬','Pink piglet'],
    language:['語言','Language'],system:['跟隨系統','System default'],
    dogfood:['肉肉','Meat'],fishfood:['魚飼料','Fish pellets'],catfood:['小魚','Fish snack'],rabbitfood:['紅蘿蔔','Carrot'],pigfood:['蘋果','Apple'],
    hungry:['肚子餓了，移入後按食碗餵食','Hungry — hover and choose the bowl to feed'],affection:['想要摸摸','Wants affection'],
    placefood:['點一下放食物 · Esc 取消','Click to place food · Esc to cancel'],loaderror:['無法載入寵物，請重啟程式','Could not load pets. Please restart.'],
    toomuchfood:['地上食物已經很多了，等牠吃完吧','There’s already plenty of food out — let it finish eating first'],
  };
  const paths = {
    toy:'<circle cx="12" cy="12" r="9"/><path d="M5 5c6 3 11 8 14 14M5 19C11 16 16 11 19 5"/>',
    energy:'<path d="m14 2-9 12h6l-1 8 9-12h-6l1-8Z"/>',
    cleanliness:'<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z"/>',
    happiness:'<path d="M12 20S2 14 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 6-10 12-10 12Z"/>',
    choose:'<ellipse cx="12" cy="16" rx="5" ry="4"/><ellipse cx="5" cy="9" rx="2" ry="2.7"/><ellipse cx="10" cy="5" rx="2" ry="2.7"/><ellipse cx="16" cy="5" rx="2" ry="2.7"/><ellipse cx="20" cy="10" rx="2" ry="2.7"/>',
    feed:'<path d="M3 12h18c0 6-3 8-9 8s-9-2-9-8Z"/><path d="M7 8c-2-3 2-3 0-6m5 6c-2-3 2-3 0-6m5 6c-2-3 2-3 0-6"/>',
    pet:'<path d="M12 20S2 14 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 6-10 12-10 12Z"/>',
    clean:'<path d="m14 3-4 10m-5 0 9 3-2 6H2l3-9Zm10-6 2-3m2 7h3m-3 4 2 2"/>',
    sleep:'<path d="M19 15A8 8 0 0 1 9 4 8 8 0 1 0 19 15Z"/><path d="M16 3h5l-5 5h5"/>',
    wake:'<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    water:'<path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z"/><path d="M8 15c0 3 2 4 4 4"/>',
    stretch:'<circle cx="12" cy="5" r="2.5"/><path d="m3 8 9 3 9-3m-9 3v6m0 0-5 5m5-5 5 5"/>',
    done:'<path d="m4 12 5 5L20 6"/>', later:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    reveal:'<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/><circle cx="12" cy="12" r="3"/>',
    help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.9-.8c.3.9-.1 1.6-.9 2.3-.7.6-1 1-1 2"/><path d="M12 17h.01"/>',
    dogfood:'<path fill="#c96e5d" stroke="#914c40" d="M4 6c5-6 16-2 17 5s-6 12-13 9S0 12 4 6Z"/><path stroke="#efb5a2" d="M6 7c4-3 11-1 12 4s-4 8-9 6-6-7-3-10Z"/><ellipse cx="10" cy="11" rx="2.5" ry="2" fill="#fff0d8" stroke="#efb5a2"/>',
    fishfood:'<g fill="#b87938" stroke="#875324"><circle cx="4" cy="15" r="1.7"/><circle cx="11" cy="19" r="1.6"/><circle cx="20" cy="15" r="1.5"/><circle cx="9" cy="10" r="1.6"/><circle cx="17" cy="7" r="1.5"/></g>',
    catfood:'<path fill="#77b4ca" stroke="#397b96" d="M17 12c-5-8-12-5-15 0 3 5 10 8 15 0l5-5v10l-5-5Z"/><circle cx="6" cy="11" r="1" fill="#243a43" stroke="none"/>',
    rabbitfood:'<path fill="#ed9b38" stroke="#be7026" d="M14 7c6 2 4 5 2 7L4 22l4-13c1-3 3-4 6-2Z"/><path stroke="#55a452" stroke-width="3" d="m14 6 1-5m1 6 6-4m-5 6 6 1"/><path stroke="#bc722b" d="m8 12 3 1m-4 3 3 1"/>',
    pigfood:'<path fill="#e67870" stroke="#b95350" d="M12 7C2 1 0 15 7 21c2 2 3 0 5 0s3 2 5 0c7-6 5-20-5-14Z"/><path stroke="#72552e" d="M12 7V2"/><path fill="#79b870" stroke="#508c49" d="M13 5c0-4 4-4 7-3-1 4-4 4-7 3Z"/>',
  };
  const simplified = {choose:'切换宠物',feed:'喂食',clean:'清理',sleep:'休息',water:'补充水分',stretch:'起来动一动',done:'完成',later:'5 分钟后提醒',reminders:'健康提醒',enabled:'开启提醒',enabledHint:'久坐时提醒你起来动一动、记得补充水分',minutes:'分钟',settings:'设置',showPet:'显示宠物',showPetHint:'显示或隐藏桌面上的宠物',stretchHint:'每隔几分钟提醒你起来动一动',waterHint:'每隔几分钟提醒你喝水',help:'使用说明',wake:'叫醒',namePlaceholder:'给宠物取名字',reveal:'把宠物带到这个屏幕',title:'选一位桌面小伙伴',hint:'按住宠物拖动，可以移动位置\n点击它或用鼠标在它身上来回搓一搓，它会很开心\n把鼠标移到它身上，会出现喂食、休息、清理按钮\n地上出现脏东西时，点一下就能清干净',dog:'巴哥犬',fish:'小丑鱼',cat:'橘白猫',rabbit:'白兔',pig:'粉红猪',language:'语言',system:'跟随系统',dogfood:'肉肉',fishfood:'鱼饲料',catfood:'小鱼',rabbitfood:'胡萝卜',pigfood:'苹果',hungry:'肚子饿了，移入后按食碗喂食',affection:'想要摸摸',placefood:'点击放食物 · Esc 取消',loaderror:'无法载入宠物，请重启程序',toomuchfood:'地上食物已经很多了，等它吃完吧'};
  Object.assign(simplified, {toy:'玩具',stopToy:'结束玩耍 · Esc',energy:'活力',cleanliness:'干净度',happiness:'开心值',hunger:'饱食度'});
  labels.hint[0] += '\n點玩具後，拖到想放的位置並放開；牠會跑過去玩，玩完自動收起\n玩具可以再拖曳；按 Esc 提早收起';
  labels.hint[1] += '\nChoose the toy, drag it somewhere and release; your pet plays and the toy disappears afterward\nDrag the toy again to move it; press Esc to put it away';
  simplified.hint += '\n点玩具后，拖到想放的位置并放开；它会跑过去玩，玩完自动收起\n玩具可以再次拖动；按 Esc 提前收起';
  const t = key => resolved()==='zh-Hans' ? simplified[key] ?? labels[key]?.[0] ?? key : labels[key]?.[resolved()==='en'?1:0] ?? key;
  const icon = key => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key] ?? paths.choose}</svg>`;
  const prompts = {
    water: [['喝水囉！','Water break!'],['記得補充水分！','Remember to hydrate!'],['該喝水啦！','Time for a drink of water!'],['來杯水，補充一下！','Grab some water!']],
    stretch: [['伸個懶腰！','Stretch break!'],['起來走走吧！','Time to get up and walk around!'],['動一動筋骨！','Give your body a stretch!'],['站起來伸展一下！','Stand up and loosen up!']],
  };
  const simplifiedPrompts = {
    water: ['喝水啦！','记得补充水分！','该喝水啦！','来杯水，补充一下！'],
    stretch: ['伸个懒腰！','起来走走吧！','动一动筋骨！','站起来伸展一下！'],
  };
  function prompt(kind, index) {
    const list = prompts[kind] ?? prompts.stretch;
    const i = typeof index === 'number' && list[index] ? index : Math.floor(Math.random() * list.length);
    const text = resolved()==='zh-Hans' ? (simplifiedPrompts[kind]?.[i] ?? list[i][0]) : list[i][resolved()==='en'?1:0];
    return { text, index: i };
  }
  function apply(next) {
    language=['system','zh-Hant','zh-Hans','en'].includes(next)?next:'system';
    document.documentElement.lang=resolved();document.title=`DesktopPal · ${t('choose')}`;
    document.querySelectorAll('[data-icon]').forEach(el=>{const key=el.dataset.icon;el.innerHTML=icon(key);el.title=t(key);el.setAttribute('aria-label',t(key));});
    document.querySelectorAll('[data-label]').forEach(el=>{el.textContent=t(el.dataset.label);});
    document.querySelectorAll('[data-hint]').forEach(el=>{const text=t(el.dataset.hint);el.dataset.tip=text;el.setAttribute('aria-label',text);el.removeAttribute('title');});
    document.querySelectorAll('[data-placeholder]').forEach(el=>{el.placeholder=t(el.dataset.placeholder);});
    const selector=document.getElementById('language-choice');if(selector)selector.value=language;
    window.dispatchEvent(new Event('pet-language-changed'));
  }
  window.PetUI = { get zh(){return resolved().startsWith('zh');},get language(){return language;},t,icon,prompt };
  apply(language);
  window.petAPI.getLanguage().then(apply).catch(console.error);
  window.petAPI.onLanguage(apply);
  function positionHint(el) {
    const margin = 10, tipWidth = Math.min(240, window.innerWidth - margin * 2);
    const rect = el.getBoundingClientRect();
    let left = 0;
    const overflowRight = rect.left + left + tipWidth + margin - window.innerWidth;
    if (overflowRight > 0) left -= overflowRight;
    const minLeft = margin - rect.left;
    if (left < minLeft) left = minLeft;
    el.style.setProperty('--tip-left', `${left}px`);
  }
  document.querySelectorAll('[data-hint]').forEach(el => {
    el.addEventListener('mouseenter', () => positionHint(el));
    el.addEventListener('focus', () => positionHint(el));
  });
})();
