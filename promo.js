/* Scoped enhancement only. No cart mutation, tracking, storage, fetch or order submission. */
(() => {
  'use strict';
  const root=document.getElementById('dussehra-preorders');
  if (!root || !window.TSKPreorder) return;
  const find=selector=>root.querySelector(selector);
  const choices=Array.from(root.querySelectorAll('[data-promo-choice]'));
  const form=find('[data-promo-form]'), review=find('[data-promo-review]');
  const ids=()=>choices.filter(input=>input.checked).map(input=>input.value);
  const sync=()=>{
    const count=TSKPreorder.selected(ids()).length;
    find('[data-promo-count]').textContent=count===0?'Choose the dishes you would like to ask about.':count+' '+(count===1?'dish selected':'dishes selected')+'. Prices and availability will be confirmed by TSK.';
    find('[data-promo-error]').textContent='';
    choices[0].removeAttribute('aria-invalid');
  };
  choices.forEach(input=>input.addEventListener('change',sync));
  find('[data-promo-clear]').addEventListener('click',()=>{choices.forEach(input=>{input.checked=false;});sync();choices[0].focus();});
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const selected=ids(), text=TSKPreorder.message(selected);
    if (!text) {
      find('[data-promo-error]').textContent='Choose at least one dish, or call us to discuss your preorder.';
      choices[0].setAttribute('aria-invalid','true');choices[0].focus();return;
    }
    find('[data-promo-message]').textContent=text;
    find('[data-promo-continue]').href=TSKPreorder.link(selected);
    form.hidden=true;review.hidden=false;find('[data-promo-review-title]').focus();
  });
  find('[data-promo-edit]').addEventListener('click',()=>{review.hidden=true;form.hidden=false;sync();choices.find(input=>input.checked)?.focus();});
  window.addEventListener('pageshow',()=>{
    // Browser back preserves native checkbox state; keep the displayed review/link consistent.
    sync();
    if (!review.hidden) {
      const text=TSKPreorder.message(ids());
      if (!text) {review.hidden=true;form.hidden=false;}
      else {find('[data-promo-message]').textContent=text;find('[data-promo-continue]').href=TSKPreorder.link(ids());}
    }
  });
  sync();
  form.hidden=false;
})();
