<script>
  import Drawer from "./Drawer.svelte";
  import ToastStack from "./ToastStack.svelte";
  import appState from "../state.js";

  let drawerOpen = $state(false);
  let toasts = $state([]);
  let toastId = 0;

  export function showToast(message) {
    const id = ++toastId;
    toasts = [...toasts, { id, message }];

    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
    }, 2880);
  }
  let drawerRef = $state(null);
  export function refreshSettings() {
    if (drawerRef) drawerRef.refreshSettings();
  }
  export function refreshSkills() {
    if (drawerRef) drawerRef.refreshSkills();
  }
  export function refreshMemories() {
    if (drawerRef) drawerRef.refreshMemories();
  }
  function openDrawer() {
    drawerOpen = true;
  }
  function closeDrawer() {
    drawerOpen = false;
  }
  window.addEventListener("dsm:open", openDrawer);
</script>

<Drawer bind:this={drawerRef} open={drawerOpen} onclose={closeDrawer} />

<ToastStack {toasts} />