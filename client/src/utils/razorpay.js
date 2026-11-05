let scriptPromise = null;

export function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error('Razorpay Checkout loaded but was unavailable.'));
    };
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Could not load Razorpay Checkout. Check your internet connection.'));
    };
    document.body.appendChild(script);
  });

  return scriptPromise;
}
