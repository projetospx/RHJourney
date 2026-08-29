(function(){
  'use strict';

  function isDarkColor(color){
    const match=String(color||'').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if(!match) return false;
    const [r,g,b]=match.slice(1).map(Number);
    const luminance=(0.2126*r+0.7152*g+0.0722*b)/255;
    return luminance<0.45;
  }

  function syncThemeClass(){
    const body=document.body;
    if(!body) return;

    const stored=[
      localStorage.getItem('theme'),
      localStorage.getItem('shopeeJourneyTheme'),
      localStorage.getItem('journey-theme')
    ].filter(Boolean).join(' ').toLowerCase();

    const htmlTheme=(document.documentElement.getAttribute('data-theme')||'').toLowerCase();
    const bodyTheme=(body.getAttribute('data-theme')||'').toLowerCase();
    const classText=(document.documentElement.className+' '+body.className).toLowerCase();
    const bg=getComputedStyle(body).backgroundColor;

    const dark =
      stored.includes('dark') ||
      htmlTheme==='dark' ||
      bodyTheme==='dark' ||
      /dark|night/.test(classText) ||
      isDarkColor(bg);

    body.classList.toggle('sj-dark', dark);
  }

  document.addEventListener('DOMContentLoaded',()=>{
    syncThemeClass();
    setTimeout(syncThemeClass,150);
    setTimeout(syncThemeClass,700);

    document.addEventListener('click',event=>{
      if(event.target.closest('[data-theme-toggle],#themeToggleApp')){
        setTimeout(syncThemeClass,30);
        setTimeout(syncThemeClass,250);
      }
    });

    const observer=new MutationObserver(()=>syncThemeClass());
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['class','data-theme']});
    observer.observe(document.body,{attributes:true,attributeFilter:['class','data-theme']});
  });
})();
