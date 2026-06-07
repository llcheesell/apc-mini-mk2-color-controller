# APC Color Controller

Akai Professional APC mini mk2 の 8x8 RGB パッドLEDと周辺単色LEDを、Abletonなしで設定するためのデスクトップアプリです。Electron + Web MIDI で作っているので、macOS / Windows の両方を想定しています。

## ダウンロード

配布版は [GitHub Releases](https://github.com/llcheesell/apc-mini-mk2-color-controller/releases) からダウンロードできます。

- macOS Apple Silicon: `.dmg` または `.zip`
- Windows: Windows環境でビルドした `.exe` インストーラー

現在のmacOSビルドはローカル配布向けの未公証アプリです。初回起動時にGatekeeperの確認が出る場合があります。

## 使い方

```bash
npm install
npm run dev
```

ビルド済み画面で起動する場合:

```bash
npm start
```

配布パッケージ作成:

```bash
npm run dist
```

macOSでは `release/mac-arm64/APC Color Controller.app`、DMG、ZIP が生成されます。Windows版はWindows環境で同じ `npm run dist` を実行するとNSISインストーラーを作成します。

## 機能

- 8x8パッドを個別に色変更
- 行カラー / 列カラーを8本ずつ保持し、行または列単位で一括反映
- プリセット適用、JSON書き出し / 読み込み
- 送信後のMIDIポート解放、送信して終了
- アニメーションモード
  - ゲーミング: 派手な虹色ループ
  - コード: スキャンラインとビット点滅
  - ビューティ: 滑らかな2色グラデーション
  - ライフゲーム: 8x8セルの世代更新

アニメーションは `Live MIDI` をオンにしたときだけ実機へ連続送信します。オフの場合は画面プレビューだけです。

## MIDI仕様メモ

参照仕様: [APC mini mk2 Communications Protocol v1.0](https://cdn.inmusicbrands.com/akai/attachments/APC%20mini%20mk2%20-%20Communication%20Protocol%20-%20v1.0.pdf)

- RGBパッドは Port 0 の Note On で制御します。
- パッド番号は `0x00` から `0x3F`。実機の下段左が `0x00`、上段右が `0x3F` です。
- Note On のチャンネルで点灯動作を指定します。`0x90` から `0x96` は明るさ違いの常時点灯、`0x97` から `0x9A` は Pulse、`0x9B` から `0x9F` は Blink です。
- Note On の velocity は公式128色パレットです。
- 任意RGBは SysEx `F0 47 7F 4F 24 ... F7` で送信します。このアプリの `Exact RGB` は常時点灯系だけ SysEx にし、Pulse/Blink は近い公式パレット色へフォールバックします。
- Trackボタンは `0x64` から `0x6B` の赤単色LED、Scene Launchは `0x70` から `0x77` の緑単色LEDです。単色LEDは velocity `0` が Off、`1` が On、`2` が Blink です。

## 常駐しない運用

`Release port` をオンにすると送信後にMIDI出力ポートを閉じます。`送信して終了` は色を送ったあとアプリを終了します。

APC mini mk2 本体に設定を不揮発保存する仕様は見つからないため、LED状態はUSB給電中、または他ソフトから別のLEDメッセージを受け取るまでの一時状態として扱ってください。電源を入れ直した後は再送信が必要です。

## Unityなどで使うとき

このアプリはMIDI入力を開かず、選択したMIDI出力へLED制御だけ送ります。Unity側は通常通りAPC mini mk2のMIDI入力を使い、必要な色をこのアプリから送ってから `送信して終了` する運用が一番干渉しにくいです。

## License

No license is specified yet.
