// Nothing here catches what the timer throws.
setTimeout(() => {
  throw new Error("uncaught in a timer");
}, 10);
