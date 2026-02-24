Output demo/demo.gif

Set Shell "bash"
Set FontSize 15
Set Width 960
Set Height 600
Set Padding 16
Set Theme "Catppuccin Mocha"
Set TypingSpeed 50ms

Sleep 500ms

Type "claude-dotfiles --help"
Enter
Sleep 3s

Type "# 1. Export your Claude Code setup"
Enter
Sleep 800ms

Type@35ms 'claude-dotfiles init -o /tmp/my-setup -n "my claude setup" -d "Full-stack dev with superpowers" -a demo -t "typescript,superpowers"'
Enter
Sleep 5s

Type "# 2. Discover other setups"
Enter
Sleep 800ms

Type "claude-dotfiles search"
Enter
Sleep 4s

Type "# 3. Preview a setup before installing"
Enter
Sleep 800ms

Type "claude-dotfiles show pjs7678/my-claude-dotfiles"
Enter
Sleep 5s

Sleep 1.5s
