document.addEventListener("DOMContentLoaded", () => {
	const yearEl = document.getElementById("year");
	if (yearEl) {
		yearEl.textContent = String(new Date().getFullYear());
	}

	const ctaButton = document.getElementById("ctaButton");
	if (ctaButton) {
		ctaButton.addEventListener("click", () => {
			const features = document.getElementById("features");
			if (features) {
				features.scrollIntoView({ behavior: "smooth", block: "start" });
			}
		});
	}
});


