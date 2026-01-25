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
      in {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_22
            pnpm
            electron
            git
          ];

          shellHook = ''
            echo ""
            echo "🚀 ekacode development environment"
            echo "   Node: $(node --version)"
            echo "   pnpm: $(pnpm --version)"
            echo "   Electron: ${pkgs.electron.version}"
            echo "   nix-ld: ✅ enabled system-wide"
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
