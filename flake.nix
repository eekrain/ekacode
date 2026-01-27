{
  description = "ekacode - Electron + SolidJS + pnpm dev environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        # Electron runtime libraries for FHS compatibility
        electronLibs = with pkgs; [
          gcc.cc.lib
          vips
          glibc

          # OpenGL (CRITICAL - Electron ANGLE)
          libglvnd # libGL.so.1
          libgbm # libgbm.so.1
          mesa # libEGL.so.1, libGLESv2.so.2
          libGL # libGL.so.1
          libGLU # GL utilities
          libxkbcommon
          xorg.libX11

          # UI
          glib
          gtk3
          gtk4
          cairo
          pango

          # X11
          xorg.libXcomposite
          xorg.libXdamage
          xorg.libXext
          xorg.libXfixes
          xorg.libXrandr
          libxcb
          expat # libexpat.so.1

          # Audio/UI
          alsa-lib
          at-spi2-atk
          cups
          dbus
          nspr
          nss
        ];

        # Library path for Electron to find dependencies
        libPath = pkgs.lib.makeLibraryPath electronLibs;
      in {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_22
            pnpm
            electron
            git
          ] ++ electronLibs;

          shellHook = ''
            # Set library path for Electron (FHS compatibility)
            export LD_LIBRARY_PATH="${libPath}:$LD_LIBRARY_PATH"

            echo ""
            echo "🚀 ekacode development environment"
            echo "   Node: $(node --version)"
            echo "   pnpm: $(pnpm --version)"
            echo "   Electron: ${pkgs.electron.version}"
            echo "   Libraries: ✅ bundled with flake"
            echo ""
            echo "Available commands:"
            echo "   pnpm dev        - Start development server"
            echo "   pnpm build      - Build for production"
            echo "   pnpm typecheck  - Run TypeScript checks"
            echo ""
          '';
        };
      }
    );
}
