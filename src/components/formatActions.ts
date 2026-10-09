import {
  CodeBlockIcon,
  CodeIcon,
  LinkSimpleIcon,
  ListBulletsIcon,
  ListNumbersIcon,
  TextBIcon,
  TextHIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  type Icon,
} from '@phosphor-icons/react'
import type { FormatAction } from '../notes/formatting'

export const FORMAT_ICONS: Record<FormatAction, Icon> = {
  bold: TextBIcon,
  italic: TextItalicIcon,
  strike: TextStrikethroughIcon,
  code: CodeIcon,
  link: LinkSimpleIcon,
  heading: TextHIcon,
  bullet: ListBulletsIcon,
  ordered: ListNumbersIcon,
  codeBlock: CodeBlockIcon,
}

export const INLINE_ACTIONS: FormatAction[] = ['bold', 'italic', 'strike', 'code', 'link']
export const BLOCK_ACTIONS: FormatAction[] = ['heading', 'bullet', 'ordered', 'codeBlock']
