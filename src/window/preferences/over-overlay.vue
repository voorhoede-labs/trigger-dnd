<template>
  <div
    class="over-overlay"
    style="
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      right: 0;
      z-index: 300;
      background-color: rgba(33, 33, 33, 0.41);
      display: flex;
      justify-content: center;
      align-items: center;
    "
  >
    <div style="max-width: 85vw; width: 500px">
      <slot />
    </div>
  </div>
</template>
