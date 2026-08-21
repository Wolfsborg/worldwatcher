(function() {
  var theme = localStorage.getItem('ww-theme');
  if (theme !== 'dark') document.documentElement.setAttribute('data-theme', 'light');
})();
