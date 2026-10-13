(function(root) {
  'use strict';
  const dishes = Object.freeze([
    {id:'natu-kodi-shorva',name:'Natu Kodi Shorva'},
    {id:'tsk-chicken-fry',name:'TSK Chicken Fry'},
    {id:'mutton-curry',name:'Mutton Curry'},
    {id:'mutton-fry',name:'Mutton Fry'},
    {id:'apricot-delight',name:'Apricot Delight'},
    {id:'other-curry',name:'Other dish / special request'}
  ]);
  function selected(ids) {
    if (!Array.isArray(ids)) return [];
    const wanted = new Set(ids);
    return dishes.filter(dish => wanted.has(dish.id));
  }
  function message(ids) {
    const choices = selected(ids);
    if (!choices.length) return '';
    return ['Hi TSK! I would like to enquire about your Dussehra pre-orders.',
      'I am interested in:', ...choices.map(dish => '- '+(dish.id==='other-curry' && typeof document!=='undefined' ? 'Other dish / special request: '+(document.querySelector('[data-custom]')?.value.trim() || 'Please discuss options with me') : dish.name)),
      'Please confirm availability, prices, portions, and the collection or delivery options for these dishes.',
      'This is a preorder enquiry, not a confirmed booking.'].join('\n');
  }
  function link(ids) {
    const text=message(ids);
    return text ? 'https://wa.me/919398693051?text='+encodeURIComponent(text) : null;
  }
  const api = {dishes, selected, message, link};
  if (typeof module !== 'undefined') module.exports=api; else root.TSKPreorder=api;
})(typeof window==='undefined'?{}:window);
